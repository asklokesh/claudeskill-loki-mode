'use strict';

const { BUILTIN_AGENT_NAMES } = require('./validator');

// In-memory registry for custom agent plugins
const _registeredAgents = new Map();

class AgentPlugin {
    /**
     * Register a custom agent plugin.
     * Cannot override built-in agent types (additive only).
     *
     * @param {object} pluginConfig - Validated agent plugin config
     * @param {object} [registry] - Optional external registry to also register into
     * @returns {{ success: boolean, error?: string }}
     */
    static register(pluginConfig, registry) {
        if (!pluginConfig || pluginConfig.type !== 'agent') {
            return { success: false, error: 'Invalid plugin config: type must be "agent"' };
        }

        const name = pluginConfig.name;

        // Prevent overriding built-in agents
        if (BUILTIN_AGENT_NAMES.includes(name)) {
            return {
                success: false,
                error: `Cannot override built-in agent type: "${name}"`,
            };
        }

        // Check for duplicate custom registration
        if (_registeredAgents.has(name)) {
            return {
                success: false,
                error: `Agent plugin "${name}" is already registered`,
            };
        }

        // Build agent definition compatible with swarm registry format
        const agentDef = {
            name: name,
            type: 'custom',
            category: pluginConfig.category || 'custom',
            description: pluginConfig.description,
            prompt_template: pluginConfig.prompt_template,
            trigger: pluginConfig.trigger || null,
            quality_gate: pluginConfig.quality_gate || false,
            capabilities: pluginConfig.capabilities || [],
            registered_at: new Date().toISOString(),
        };

        _registeredAgents.set(name, agentDef);

        // If an external registry object is provided, add to its custom category
        if (registry && typeof registry === 'object') {
            if (registry.customAgents) {
                registry.customAgents[name] = agentDef;
            }
        }

        return { success: true };
    }

    /**
     * Unregister a custom agent plugin.
     *
     * @param {string} pluginName - Name of the agent plugin to remove
     * @param {object} [registry] - Optional external registry to also remove from
     * @returns {{ success: boolean, error?: string }}
     */
    static unregister(pluginName, registry) {
        if (!_registeredAgents.has(pluginName)) {
            return { success: false, error: `Agent plugin "${pluginName}" is not registered` };
        }

        _registeredAgents.delete(pluginName);

        if (registry && registry.customAgents) {
            delete registry.customAgents[pluginName];
        }

        return { success: true };
    }

    /**
     * List all registered custom agent plugins.
     *
     * @returns {object[]} Array of agent definitions
     */
    static listRegistered() {
        return Array.from(_registeredAgents.values());
    }

    /**
     * Get a specific registered agent plugin by name.
     *
     * @param {string} name - Agent plugin name
     * @returns {object|null} Agent definition or null
     */
    static get(name) {
        return _registeredAgents.get(name) || null;
    }

    /**
     * Check if a custom agent is registered.
     *
     * @param {string} name - Agent name
     * @returns {boolean}
     */
    static isRegistered(name) {
        return _registeredAgents.has(name);
    }

    /**
     * Clear all registered custom agents (primarily for testing).
     */
    static _clearAll() {
        _registeredAgents.clear();
    }
}

module.exports = { AgentPlugin };
