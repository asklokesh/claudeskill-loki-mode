'use strict';

const { execFile } = require('child_process');
const { join } = require('path');

// In-memory registry for custom gate plugins
const _registeredGates = new Map();

class GatePlugin {
    /**
     * Register a custom quality gate plugin.
     *
     * @param {object} pluginConfig - Validated quality gate plugin config
     * @returns {{ success: boolean, error?: string }}
     */
    static register(pluginConfig) {
        if (!pluginConfig || pluginConfig.type !== 'quality_gate') {
            return { success: false, error: 'Invalid plugin config: type must be "quality_gate"' };
        }

        const name = pluginConfig.name;

        if (_registeredGates.has(name)) {
            return { success: false, error: `Gate plugin "${name}" is already registered` };
        }

        const gateDef = {
            name: name,
            description: pluginConfig.description,
            phase: pluginConfig.phase || 'pre-commit',
            command: pluginConfig.command,
            timeout_ms: pluginConfig.timeout_ms || 30000,
            blocking: pluginConfig.blocking !== undefined ? pluginConfig.blocking : true,
            severity: pluginConfig.severity || 'high',
            registered_at: new Date().toISOString(),
        };

        _registeredGates.set(name, gateDef);
        return { success: true };
    }

    /**
     * Unregister a custom quality gate plugin.
     *
     * @param {string} pluginName - Name of the gate plugin to remove
     * @returns {{ success: boolean, error?: string }}
     */
    static unregister(pluginName) {
        if (!_registeredGates.has(pluginName)) {
            return { success: false, error: `Gate plugin "${pluginName}" is not registered` };
        }

        _registeredGates.delete(pluginName);
        return { success: true };
    }

    /**
     * Execute a quality gate command.
     *
     * @param {object} pluginConfig - The gate plugin config
     * @param {string} projectDir - Project directory to run the command in
     * @returns {Promise<{ passed: boolean, output: string, duration_ms: number }>}
     */
    static async execute(pluginConfig, projectDir) {
        const command = pluginConfig.command;
        const timeoutMs = pluginConfig.timeout_ms || 30000;
        const startTime = Date.now();

        if (!command) {
            return {
                passed: false,
                output: 'Error: no command specified for quality gate',
                duration_ms: 0,
            };
        }

        return new Promise((resolve) => {
            const cwd = projectDir || process.cwd();

            // Split command into executable and args
            // Use shell execution for simple commands
            const child = execFile('/bin/sh', ['-c', command], {
                cwd,
                timeout: timeoutMs,
                maxBuffer: 1024 * 1024, // 1MB
                env: { ...process.env, LOKI_GATE: pluginConfig.name || 'unknown' },
            }, (error, stdout, stderr) => {
                const durationMs = Date.now() - startTime;
                const output = (stdout || '') + (stderr ? '\n' + stderr : '');

                if (error) {
                    if (error.killed || error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
                        resolve({
                            passed: false,
                            output: `Timeout: command exceeded ${timeoutMs}ms limit`,
                            duration_ms: durationMs,
                        });
                    } else {
                        resolve({
                            passed: false,
                            output: output.trim() || error.message || 'Command failed',
                            duration_ms: durationMs,
                        });
                    }
                } else {
                    resolve({
                        passed: true,
                        output: output.trim(),
                        duration_ms: durationMs,
                    });
                }
            });
        });
    }

    /**
     * Get all gates registered for a specific phase.
     *
     * @param {string} phase - SDLC phase
     * @returns {object[]} Array of gate definitions
     */
    static getByPhase(phase) {
        return Array.from(_registeredGates.values()).filter(g => g.phase === phase);
    }

    /**
     * List all registered gate plugins.
     *
     * @returns {object[]} Array of gate definitions
     */
    static listRegistered() {
        return Array.from(_registeredGates.values());
    }

    /**
     * Check if a gate is registered.
     *
     * @param {string} name - Gate name
     * @returns {boolean}
     */
    static isRegistered(name) {
        return _registeredGates.has(name);
    }

    /**
     * Clear all registered gates (primarily for testing).
     */
    static _clearAll() {
        _registeredGates.clear();
    }
}

module.exports = { GatePlugin };
