'use strict';

const { execFile } = require('child_process');

// In-memory registry for custom MCP tool plugins
const _registeredTools = new Map();

class MCPPlugin {
    /**
     * Register a custom MCP tool plugin.
     *
     * @param {object} pluginConfig - Validated MCP tool plugin config
     * @returns {{ success: boolean, error?: string }}
     */
    static register(pluginConfig) {
        if (!pluginConfig || pluginConfig.type !== 'mcp_tool') {
            return { success: false, error: 'Invalid plugin config: type must be "mcp_tool"' };
        }

        const name = pluginConfig.name;

        if (_registeredTools.has(name)) {
            return { success: false, error: `MCP tool plugin "${name}" is already registered` };
        }

        const toolDef = {
            name: name,
            description: pluginConfig.description,
            command: pluginConfig.command,
            parameters: pluginConfig.parameters || [],
            timeout_ms: pluginConfig.timeout_ms || 30000,
            working_directory: pluginConfig.working_directory || 'project',
            registered_at: new Date().toISOString(),
        };

        _registeredTools.set(name, toolDef);
        return { success: true };
    }

    /**
     * Unregister a custom MCP tool plugin.
     *
     * @param {string} pluginName - Name of the tool to remove
     * @returns {{ success: boolean, error?: string }}
     */
    static unregister(pluginName) {
        if (!_registeredTools.has(pluginName)) {
            return { success: false, error: `MCP tool plugin "${pluginName}" is not registered` };
        }

        _registeredTools.delete(pluginName);
        return { success: true };
    }

    /**
     * Execute an MCP tool command with parameter substitution.
     *
     * @param {object} pluginConfig - The MCP tool plugin config
     * @param {object} params - Input parameters
     * @param {string} [projectDir] - Project directory for sandbox
     * @returns {Promise<{ success: boolean, output: string, duration_ms: number }>}
     */
    static async execute(pluginConfig, params, projectDir) {
        const command = pluginConfig.command;
        const timeoutMs = pluginConfig.timeout_ms || 30000;
        const startTime = Date.now();

        if (!command) {
            return {
                success: false,
                output: 'Error: no command specified for MCP tool',
                duration_ms: 0,
            };
        }

        // Substitute parameters into command with shell-safe quoting
        let resolvedCommand = command;
        if (params && typeof params === 'object') {
            for (const [key, value] of Object.entries(params)) {
                const safeValue = MCPPlugin._sanitizeValue(value);
                resolvedCommand = resolvedCommand.replace(
                    new RegExp(`\\{\\{params\\.${key}\\}\\}`, 'g'),
                    safeValue
                );
            }
        }

        return new Promise((resolve) => {
            const cwd = projectDir || process.cwd();

            execFile('/bin/sh', ['-c', resolvedCommand], {
                cwd,
                timeout: timeoutMs,
                maxBuffer: 1024 * 1024, // 1MB
                env: { ...process.env, LOKI_MCP_TOOL: pluginConfig.name || 'unknown' },
            }, (error, stdout, stderr) => {
                const durationMs = Date.now() - startTime;
                const output = (stdout || '') + (stderr ? '\n' + stderr : '');

                if (error) {
                    if (error.killed) {
                        resolve({
                            success: false,
                            output: `Timeout: command exceeded ${timeoutMs}ms limit`,
                            duration_ms: durationMs,
                        });
                    } else {
                        resolve({
                            success: false,
                            output: output.trim() || error.message || 'Command failed',
                            duration_ms: durationMs,
                        });
                    }
                } else {
                    resolve({
                        success: true,
                        output: output.trim(),
                        duration_ms: durationMs,
                    });
                }
            });
        });
    }

    /**
     * Get the MCP tool definition in a format suitable for MCP protocol.
     *
     * @param {string} name - Tool name
     * @returns {object|null} MCP-compatible tool definition
     */
    static getMCPDefinition(name) {
        const tool = _registeredTools.get(name);
        if (!tool) return null;

        const inputSchema = {
            type: 'object',
            properties: {},
            required: [],
        };

        for (const param of tool.parameters) {
            inputSchema.properties[param.name] = {
                type: param.type || 'string',
                description: param.description || '',
            };
            if (param.default !== undefined) {
                inputSchema.properties[param.name].default = param.default;
            }
            if (param.required) {
                inputSchema.required.push(param.name);
            }
        }

        return {
            name: tool.name,
            description: tool.description,
            inputSchema,
        };
    }

    /**
     * List all registered MCP tool plugins.
     *
     * @returns {object[]}
     */
    static listRegistered() {
        return Array.from(_registeredTools.values());
    }

    /**
     * Shell-safe value sanitization using POSIX single-quote escaping.
     * Wraps value in single quotes with internal single quotes escaped.
     *
     * @param {*} value - The value to sanitize
     * @returns {string} Shell-safe quoted string
     */
    static _sanitizeValue(value) {
        const str = String(value);
        return "'" + str.replace(/'/g, "'\\''") + "'";
    }

    /**
     * Clear all registered tools (primarily for testing).
     */
    static _clearAll() {
        _registeredTools.clear();
    }
}

module.exports = { MCPPlugin };
