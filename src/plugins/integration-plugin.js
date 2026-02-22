'use strict';

const { request } = require('https');
const { request: httpRequest } = require('http');

// In-memory registry for custom integration plugins
const _registeredIntegrations = new Map();

class IntegrationPlugin {
    /**
     * Register a custom integration plugin.
     *
     * @param {object} pluginConfig - Validated integration plugin config
     * @returns {{ success: boolean, error?: string }}
     */
    static register(pluginConfig) {
        if (!pluginConfig || pluginConfig.type !== 'integration') {
            return { success: false, error: 'Invalid plugin config: type must be "integration"' };
        }

        const name = pluginConfig.name;

        if (_registeredIntegrations.has(name)) {
            return { success: false, error: `Integration plugin "${name}" is already registered` };
        }

        const intDef = {
            name: name,
            description: pluginConfig.description,
            webhook_url: pluginConfig.webhook_url,
            events: pluginConfig.events || [],
            payload_template: pluginConfig.payload_template || '{"event": "{{event.type}}", "message": "{{event.message}}"}',
            headers: pluginConfig.headers || {},
            timeout_ms: pluginConfig.timeout_ms || 5000,
            retry_count: pluginConfig.retry_count || 1,
            registered_at: new Date().toISOString(),
        };

        _registeredIntegrations.set(name, intDef);
        return { success: true };
    }

    /**
     * Unregister a custom integration plugin.
     *
     * @param {string} pluginName - Name of the integration to remove
     * @returns {{ success: boolean, error?: string }}
     */
    static unregister(pluginName) {
        if (!_registeredIntegrations.has(pluginName)) {
            return { success: false, error: `Integration plugin "${pluginName}" is not registered` };
        }

        _registeredIntegrations.delete(pluginName);
        return { success: true };
    }

    /**
     * Render a template string with event data.
     * Replaces {{event.field}} patterns with actual event values.
     *
     * @param {string} template - Template string
     * @param {object} event - Event data
     * @returns {string} Rendered string
     */
    static renderTemplate(template, event) {
        if (!template || typeof template !== 'string') return template || '';

        return template.replace(/\{\{event\.(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
            const parts = path.split('.');
            let value = event;
            for (const part of parts) {
                if (value === null || value === undefined) return '';
                value = value[part];
            }
            if (value === undefined || value === null) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            // JSON-safe escape: handles quotes, backslashes, control chars
            return JSON.stringify(String(value)).slice(1, -1);
        });
    }

    /**
     * Handle an event by sending it to the integration webhook.
     * Fire-and-forget with timeout.
     *
     * @param {object} pluginConfig - The integration plugin config
     * @param {object} event - The event data
     * @returns {Promise<{ sent: boolean, status?: number, error?: string }>}
     */
    static async handleEvent(pluginConfig, event) {
        const webhookUrl = pluginConfig.webhook_url;
        const timeoutMs = pluginConfig.timeout_ms || 5000;
        const headers = { ...pluginConfig.headers, 'Content-Type': 'application/json' };

        // Render payload template
        const payload = IntegrationPlugin.renderTemplate(
            pluginConfig.payload_template || '{"event": "{{event.type}}", "message": "{{event.message}}"}',
            event
        );

        return new Promise((resolve) => {
            try {
                const url = new URL(webhookUrl);
                const isHttps = url.protocol === 'https:';
                const reqFn = isHttps ? request : httpRequest;

                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Length': Buffer.byteLength(payload),
                    },
                    timeout: timeoutMs,
                };

                const req = reqFn(options, (res) => {
                    let body = '';
                    res.on('data', (chunk) => { body += chunk; });
                    res.on('end', () => {
                        resolve({ sent: true, status: res.statusCode });
                    });
                });

                req.on('error', (err) => {
                    resolve({ sent: false, error: err.message });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({ sent: false, error: `Timeout after ${timeoutMs}ms` });
                });

                req.write(payload);
                req.end();
            } catch (err) {
                resolve({ sent: false, error: err.message });
            }
        });
    }

    /**
     * Get integrations subscribed to a specific event type.
     *
     * @param {string} eventType - The event type
     * @returns {object[]} Matching integration definitions
     */
    static getByEvent(eventType) {
        return Array.from(_registeredIntegrations.values()).filter(
            i => i.events.includes(eventType) || i.events.includes('*')
        );
    }

    /**
     * List all registered integration plugins.
     *
     * @returns {object[]}
     */
    static listRegistered() {
        return Array.from(_registeredIntegrations.values());
    }

    /**
     * Clear all registered integrations (primarily for testing).
     */
    static _clearAll() {
        _registeredIntegrations.clear();
    }
}

module.exports = { IntegrationPlugin };
