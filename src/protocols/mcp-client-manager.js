'use strict';

var fs = require('fs');
var path = require('path');
var MCPClientModule = require('./mcp-client');
var MCPClient = MCPClientModule.MCPClient;
var CircuitBreakerModule = require('./mcp-circuit-breaker');
var CircuitBreaker = CircuitBreakerModule.CircuitBreaker;

/**
 * MCP Client Manager
 *
 * Manages connections to multiple MCP servers. Reads server configuration from
 * `.loki/config.json` or `.loki/config.yaml` (minimal YAML subset). Routes
 * tool calls to the correct server automatically.
 *
 * Security:
 *   - configDir must resolve within process.cwd() to prevent path traversal.
 *   - YAML parser rejects __proto__/constructor/prototype keys (prototype pollution).
 *   - discoverTools() is idempotent.
 */

var FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function validateConfigDir(configDir) {
  var root = process.cwd();
  var resolved = path.resolve(configDir);
  var rootSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && resolved.indexOf(rootSep) !== 0) {
    throw new Error(
      'MCPClientManager: configDir "' + configDir + '" resolves to "' + resolved +
      '" which is outside the project root "' + root + '". ' +
      'Supply a path within the project directory.'
    );
  }
  return resolved;
}

class MCPClientManager {
  constructor(options) {
    var opts = options || {};
    this._configDir = validateConfigDir(opts.configDir || '.loki');
    this._timeout = opts.timeout || 30000;
    this._failureThreshold = opts.failureThreshold || 3;
    this._resetTimeout = opts.resetTimeout || 30000;

    this._clients = new Map();
    this._breakers = new Map();
    this._toolRouting = new Map();
    this._toolSchemas = new Map();
    this._initialized = false;
  }

  get initialized() { return this._initialized; }
  get serverCount() { return this._clients.size; }

  async discoverTools() {
    if (this._initialized) return this.getAllTools();

    var config = this._loadConfig();
    if (!config || !config.mcp_servers || config.mcp_servers.length === 0) {
      this._initialized = true;
      return [];
    }

    var allTools = [];

    for (var i = 0; i < config.mcp_servers.length; i++) {
      var serverConfig = config.mcp_servers[i];
      if (!serverConfig.name) continue;

      var client = new MCPClient({
        name: serverConfig.name,
        command: serverConfig.command || null,
        args: serverConfig.args || [],
        url: serverConfig.url || null,
        auth: serverConfig.auth || null,
        token_env: serverConfig.token_env || null,
        timeout: serverConfig.timeout || this._timeout
      });

      var breaker = new CircuitBreaker({
        failureThreshold: this._failureThreshold,
        resetTimeout: this._resetTimeout
      });

      this._clients.set(serverConfig.name, client);
      this._breakers.set(serverConfig.name, breaker);

      try {
        var self = this;
        var serverName = serverConfig.name;
        var tools = await breaker.execute(function() { return client.connect(); });
        for (var j = 0; j < tools.length; j++) {
          var tool = tools[j];
          if (self._toolRouting.has(tool.name)) {
            var existing = self._toolRouting.get(tool.name);
            process.stderr.write(
              '[mcp-manager] WARNING: tool "' + tool.name + '" from "' + serverName +
              '" collides with "' + existing + '". Earlier registration kept.\n'
            );
          } else {
            self._toolRouting.set(tool.name, serverName);
            self._toolSchemas.set(tool.name, tool);
          }
        }
        allTools.push.apply(allTools, tools);
      } catch (err) {
        process.stderr.write(
          '[mcp-manager] Failed to connect to server "' + serverConfig.name + '": ' + err.message + '\n'
        );
      }
    }

    this._initialized = true;
    return allTools;
  }

  getToolsByServer(serverName) {
    var client = this._clients.get(serverName);
    if (!client || !client.tools) return [];
    return client.tools.slice();
  }

  getAllTools() {
    var tools = [];
    for (var schema of this._toolSchemas.values()) { tools.push(schema); }
    return tools;
  }

  async callTool(toolName, args) {
    var serverName = this._toolRouting.get(toolName);
    if (!serverName) throw new Error('No server found for tool: ' + toolName);

    var client = this._clients.get(serverName);
    if (!client) throw new Error('Client not found for server: ' + serverName);

    var breaker = this._breakers.get(serverName);
    if (!breaker) throw new Error('Circuit breaker not found for server: ' + serverName);

    return breaker.execute(function() { return client.callTool(toolName, args); });
  }

  getServerState(serverName) {
    var breaker = this._breakers.get(serverName);
    return breaker ? breaker.state : null;
  }

  async shutdown() {
    var shutdowns = [];
    for (var client of this._clients.values()) { shutdowns.push(client.shutdown()); }
    await Promise.all(shutdowns);
    for (var breaker of this._breakers.values()) { breaker.destroy(); }
    this._clients.clear();
    this._breakers.clear();
    this._toolRouting.clear();
    this._toolSchemas.clear();
    this._initialized = false;
  }

  _loadConfig() {
    var jsonPath = path.join(this._configDir, 'config.json');
    var yamlPath = path.join(this._configDir, 'config.yaml');

    if (fs.existsSync(jsonPath)) {
      try {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (err) {
        process.stderr.write('[mcp-manager] Failed to parse config.json: ' + err.message + '\n');
        return null;
      }
    }

    if (fs.existsSync(yamlPath)) {
      try {
        return this._parseMinimalYaml(fs.readFileSync(yamlPath, 'utf8'));
      } catch (err) {
        process.stderr.write('[mcp-manager] Failed to parse config.yaml: ' + err.message + '\n');
        return null;
      }
    }

    return null;
  }

  /**
   * Minimal YAML subset parser.
   * FORBIDDEN_KEYS are silently skipped on all assignments to prevent prototype pollution.
   */
  _parseMinimalYaml(raw) {
    var result = {};
    var lines = raw.split('\n');
    var currentKey = null;
    var currentList = null;
    var currentItem = null;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].replace(/\r$/, '');

      if (/^\s*$/.test(trimmed) || /^\s*#/.test(trimmed)) continue;

      var topMatch = trimmed.match(/^(\w+):\s*$/);
      if (topMatch) {
        var k = topMatch[1];
        if (FORBIDDEN_KEYS.has(k)) continue;
        currentKey = k;
        currentList = [];
        result[currentKey] = currentList;
        currentItem = null;
        continue;
      }

      var topValMatch = trimmed.match(/^(\w+):\s+(.+)$/);
      if (topValMatch && !trimmed.startsWith(' ') && !trimmed.startsWith('\t')) {
        var kv = topValMatch[1];
        if (!FORBIDDEN_KEYS.has(kv)) result[kv] = this._parseYamlValue(topValMatch[2]);
        continue;
      }

      if (!currentKey || !currentList) continue;

      var listItemMatch = trimmed.match(/^\s+-\s+(\w+):\s+(.+)$/);
      if (listItemMatch) {
        var ki = listItemMatch[1];
        currentItem = {};
        if (!FORBIDDEN_KEYS.has(ki)) currentItem[ki] = this._parseYamlValue(listItemMatch[2]);
        currentList.push(currentItem);
        continue;
      }

      var contMatch = trimmed.match(/^\s+(\w+):\s+(.+)$/);
      if (contMatch && currentItem) {
        var kc = contMatch[1];
        if (!FORBIDDEN_KEYS.has(kc)) currentItem[kc] = this._parseYamlValue(contMatch[2]);
        continue;
      }
    }

    return result;
  }

  _parseYamlValue(val) {
    val = val.trim();
    var ci = val.indexOf(' #');
    if (ci !== -1) val = val.slice(0, ci).trim();

    if (val.startsWith('[') && val.endsWith(']')) {
      try { return JSON.parse(val); } catch (_) { return val; }
    }

    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1);
    }

    if (val === 'true') return true;
    if (val === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);

    return val;
  }
}

module.exports = { MCPClientManager: MCPClientManager, validateConfigDir: validateConfigDir };
