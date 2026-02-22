'use strict';

const { readFileSync } = require('fs');
const { join } = require('path');

// Built-in agent names that cannot be overridden by plugins
const BUILTIN_AGENT_NAMES = [
    'eng-frontend', 'eng-backend', 'eng-database', 'eng-mobile',
    'eng-api', 'eng-qa', 'eng-perf', 'eng-infra',
    'ops-devops', 'ops-sre', 'ops-security', 'ops-monitor',
    'ops-incident', 'ops-release', 'ops-cost', 'ops-compliance',
    'biz-marketing', 'biz-sales', 'biz-finance', 'biz-legal',
    'biz-support', 'biz-hr', 'biz-investor', 'biz-partnerships',
    'data-ml', 'data-eng', 'data-analytics',
    'prod-pm', 'prod-design', 'prod-techwriter',
    'growth-hacker', 'growth-community', 'growth-success', 'growth-lifecycle',
    'review-code', 'review-business', 'review-security',
    'orch-planner', 'orch-sub-planner', 'orch-judge', 'orch-coordinator',
];

// Dangerous shell metacharacters
const SHELL_INJECTION_PATTERN = /[|;&`<>]|\$\(|`.*`|\$\{(?!ENV_)|\n|\r/;

// Allowed template variable patterns
const ALLOWED_TEMPLATE_PATTERNS = [
    /\{\{event\.\w+(\.\w+)*\}\}/,   // {{event.type}}, {{event.data.field}}
    /\$\{ENV_[A-Z_]+\}/,             // ${ENV_VAR_NAME}
];

// Valid plugin types
const VALID_PLUGIN_TYPES = ['agent', 'quality_gate', 'integration', 'mcp_tool'];

// Schema file mapping
const SCHEMA_FILES = {
    agent: 'agent.json',
    quality_gate: 'quality_gate.json',
    integration: 'integration.json',
    mcp_tool: 'mcp_tool.json',
};

class PluginValidator {
    /**
     * Create a new PluginValidator.
     * @param {string} schemasDir - Path to the schemas directory
     */
    constructor(schemasDir) {
        this.schemasDir = schemasDir || join(__dirname, 'schemas');
        this._schemaCache = {};
    }

    /**
     * Load a JSON schema for a plugin type.
     * @param {string} pluginType - The plugin type
     * @returns {object|null} The parsed schema or null
     */
    _loadSchema(pluginType) {
        if (this._schemaCache[pluginType]) {
            return this._schemaCache[pluginType];
        }

        const schemaFile = SCHEMA_FILES[pluginType];
        if (!schemaFile) {
            return null;
        }

        try {
            const schemaPath = join(this.schemasDir, schemaFile);
            const content = readFileSync(schemaPath, 'utf8');
            const schema = JSON.parse(content);
            this._schemaCache[pluginType] = schema;
            return schema;
        } catch (err) {
            return null;
        }
    }

    /**
     * Validate a plugin configuration.
     * @param {object} pluginConfig - The plugin configuration to validate
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(pluginConfig) {
        const errors = [];

        // 1. Check that config is an object
        if (!pluginConfig || typeof pluginConfig !== 'object' || Array.isArray(pluginConfig)) {
            return { valid: false, errors: ['Plugin config must be a non-null object'] };
        }

        // 2. Check required base fields
        if (!pluginConfig.type) {
            errors.push('Missing required field: type');
        }
        if (!pluginConfig.name) {
            errors.push('Missing required field: name');
        }

        // If we cannot determine type, return early
        if (!pluginConfig.type) {
            return { valid: false, errors };
        }

        // 3. Check plugin type is valid
        if (!VALID_PLUGIN_TYPES.includes(pluginConfig.type)) {
            errors.push(`Unknown plugin type: "${pluginConfig.type}". Valid types: ${VALID_PLUGIN_TYPES.join(', ')}`);
            return { valid: false, errors };
        }

        // 4. Load and validate against schema
        const schema = this._loadSchema(pluginConfig.type);
        if (schema) {
            const schemaErrors = this._validateAgainstSchema(pluginConfig, schema);
            errors.push(...schemaErrors);
        }

        // 5. Security checks
        const securityErrors = this._securityChecks(pluginConfig);
        errors.push(...securityErrors);

        // 6. Built-in name collision check (for agents)
        if (pluginConfig.type === 'agent' && pluginConfig.name) {
            if (BUILTIN_AGENT_NAMES.includes(pluginConfig.name)) {
                errors.push(`Name "${pluginConfig.name}" conflicts with a built-in agent type. Custom agents must use unique names.`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate config against a JSON schema (simplified validator).
     * @param {object} config - The config to validate
     * @param {object} schema - The JSON schema
     * @returns {string[]} List of validation errors
     */
    _validateAgainstSchema(config, schema) {
        const errors = [];

        // Check required fields
        if (schema.required && Array.isArray(schema.required)) {
            for (const field of schema.required) {
                if (config[field] === undefined || config[field] === null || config[field] === '') {
                    errors.push(`Missing required field: ${field}`);
                }
            }
        }

        // Check property types and constraints
        if (schema.properties) {
            for (const [key, propSchema] of Object.entries(schema.properties)) {
                const value = config[key];
                if (value === undefined || value === null) {
                    continue; // Skip if not present (required check above handles that)
                }

                // Type check
                if (propSchema.type) {
                    const typeValid = this._checkType(value, propSchema.type);
                    if (!typeValid) {
                        errors.push(`Field "${key}" must be of type ${propSchema.type}, got ${typeof value}`);
                        continue;
                    }
                }

                // Const check
                if (propSchema.const !== undefined && value !== propSchema.const) {
                    errors.push(`Field "${key}" must be "${propSchema.const}"`);
                }

                // Enum check
                if (propSchema.enum && !propSchema.enum.includes(value)) {
                    errors.push(`Field "${key}" must be one of: ${propSchema.enum.join(', ')}`);
                }

                // Pattern check (string)
                if (propSchema.pattern && typeof value === 'string') {
                    const regex = new RegExp(propSchema.pattern);
                    if (!regex.test(value)) {
                        errors.push(`Field "${key}" does not match pattern ${propSchema.pattern}`);
                    }
                }

                // MaxLength check (string)
                if (propSchema.maxLength !== undefined && typeof value === 'string') {
                    if (value.length > propSchema.maxLength) {
                        errors.push(`Field "${key}" exceeds maximum length of ${propSchema.maxLength} (got ${value.length})`);
                    }
                }

                // MinItems check (array)
                if (propSchema.minItems !== undefined && Array.isArray(value)) {
                    if (value.length < propSchema.minItems) {
                        errors.push(`Field "${key}" must have at least ${propSchema.minItems} items`);
                    }
                }

                // Minimum check (integer/number)
                if (propSchema.minimum !== undefined && typeof value === 'number') {
                    if (value < propSchema.minimum) {
                        errors.push(`Field "${key}" must be >= ${propSchema.minimum}`);
                    }
                }

                // Maximum check (integer/number)
                if (propSchema.maximum !== undefined && typeof value === 'number') {
                    if (value > propSchema.maximum) {
                        errors.push(`Field "${key}" must be <= ${propSchema.maximum}`);
                    }
                }
            }

            // Check for additional properties (if additionalProperties is false)
            if (schema.additionalProperties === false) {
                const allowedKeys = Object.keys(schema.properties);
                for (const key of Object.keys(config)) {
                    if (!allowedKeys.includes(key)) {
                        errors.push(`Unknown field: "${key}" is not allowed`);
                    }
                }
            }
        }

        return errors;
    }

    /**
     * Check if a value matches a JSON schema type.
     * @param {*} value - The value to check
     * @param {string} type - The expected type
     * @returns {boolean}
     */
    _checkType(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
            case 'integer':
                return typeof value === 'number' && (type !== 'integer' || Number.isInteger(value));
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && !Array.isArray(value) && value !== null;
            default:
                return true;
        }
    }

    /**
     * Run security checks on a plugin config.
     * @param {object} config - The plugin configuration
     * @returns {string[]} List of security errors
     */
    _securityChecks(config) {
        const errors = [];

        // Check command fields for shell injection
        const commandFields = ['command'];
        for (const field of commandFields) {
            if (typeof config[field] === 'string') {
                if (SHELL_INJECTION_PATTERN.test(config[field])) {
                    errors.push(`Security: field "${field}" contains potentially dangerous shell metacharacters (|, ;, &, $(), backticks). Use simple commands only.`);
                }
            }
        }

        // Check prompt_template for size and suspicious patterns
        if (typeof config.prompt_template === 'string') {
            if (config.prompt_template.length > 10000) {
                errors.push(`Field "prompt_template" exceeds maximum length of 10000`);
            }
        }

        // Check payload_template for injection
        if (typeof config.payload_template === 'string') {
            // Scan for template variables that are not in the allowed list
            const templateVarPattern = /\{\{(?!event\.)[^}]+\}\}/g;
            const disallowed = config.payload_template.match(templateVarPattern);
            if (disallowed && disallowed.length > 0) {
                errors.push(`Security: payload_template contains disallowed template variables: ${disallowed.join(', ')}. Only {{event.*}} patterns are allowed.`);
            }
        }

        // Check webhook_url is HTTPS or localhost
        if (typeof config.webhook_url === 'string') {
            const url = config.webhook_url.toLowerCase();
            if (!url.startsWith('https://') && !url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
                errors.push('Security: webhook_url must use HTTPS or localhost');
            }
        }

        return errors;
    }
}

module.exports = { PluginValidator, BUILTIN_AGENT_NAMES, VALID_PLUGIN_TYPES };
