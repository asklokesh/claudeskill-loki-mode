'use strict';

const { PluginValidator, BUILTIN_AGENT_NAMES, VALID_PLUGIN_TYPES } = require('./validator');
const { PluginLoader, parseSimpleYAML } = require('./loader');
const { AgentPlugin } = require('./agent-plugin');
const { GatePlugin } = require('./gate-plugin');
const { IntegrationPlugin } = require('./integration-plugin');
const { MCPPlugin } = require('./mcp-plugin');

// Plugin type to handler mapping
const PLUGIN_HANDLERS = {
    agent: AgentPlugin,
    quality_gate: GatePlugin,
    integration: IntegrationPlugin,
    mcp_tool: MCPPlugin,
};

/**
 * Initialize the plugin system: discover, load, validate, and register all plugins.
 *
 * @param {string} [pluginsDir='.loki/plugins'] - Path to plugins directory
 * @param {string} [schemasDir] - Path to schemas directory (defaults to built-in schemas)
 * @param {object} [options] - Additional options
 * @param {object} [options.agentRegistry] - External agent registry to register agents into
 * @param {boolean} [options.watch=false] - Watch for file changes
 * @returns {{ loaded: number, failed: number, details: { loaded: object[], failed: object[] } }}
 */
function initializePlugins(pluginsDir, schemasDir, options) {
    const opts = options || {};
    const loader = new PluginLoader(pluginsDir, schemasDir);
    const { loaded, failed } = loader.loadAll();

    const registered = [];
    const registrationErrors = [];

    for (const plugin of loaded) {
        const handler = PLUGIN_HANDLERS[plugin.config.type];
        if (!handler) {
            registrationErrors.push({
                path: plugin.path,
                errors: [`No handler for plugin type: ${plugin.config.type}`],
            });
            continue;
        }

        let result;
        if (plugin.config.type === 'agent') {
            result = handler.register(plugin.config, opts.agentRegistry);
        } else {
            result = handler.register(plugin.config);
        }

        if (result.success) {
            registered.push(plugin);
        } else {
            registrationErrors.push({
                path: plugin.path,
                errors: [result.error],
            });
        }
    }

    // Set up file watching if requested
    let stopWatching = null;
    if (opts.watch) {
        stopWatching = loader.watchForChanges((eventType, filePath) => {
            const fs = require('fs');
            const path = require('path');

            // Handle file deletion
            if (!fs.existsSync(filePath)) {
                const name = path.basename(filePath, path.extname(filePath));
                for (const handler of Object.values(PLUGIN_HANDLERS)) {
                    if (handler.unregister) handler.unregister(name);
                }
                return;
            }

            const { config, errors } = loader.loadOne(filePath);
            if (config) {
                const handler = PLUGIN_HANDLERS[config.type];
                if (handler) {
                    // Only unregister AFTER successful load and validation
                    if (handler.unregister) handler.unregister(config.name);
                    handler.register(config, opts.agentRegistry);
                }
            }
            // If loadOne fails, keep old plugin registered (fail-safe)
        });
    }

    const allFailed = [...failed, ...registrationErrors];

    return {
        loaded: registered.length,
        failed: allFailed.length,
        details: {
            loaded: registered,
            failed: allFailed,
        },
        stopWatching: stopWatching || (() => {}),
    };
}

module.exports = {
    PluginValidator,
    PluginLoader,
    AgentPlugin,
    GatePlugin,
    IntegrationPlugin,
    MCPPlugin,
    initializePlugins,
    parseSimpleYAML,
    BUILTIN_AGENT_NAMES,
    VALID_PLUGIN_TYPES,
};
