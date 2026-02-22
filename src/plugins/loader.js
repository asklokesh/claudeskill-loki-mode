'use strict';

const { readFileSync, readdirSync, existsSync, statSync, watch } = require('fs');
const { join, extname } = require('path');
const { PluginValidator } = require('./validator');

/**
 * Simple YAML parser for plugin configs.
 * Handles: key-value pairs, arrays (- item), multiline strings (|), booleans, numbers.
 * This avoids requiring the js-yaml dependency.
 */
function parseSimpleYAML(content) {
    const result = {};
    const lines = content.split('\n');
    let currentKey = null;
    let multilineValue = null;
    let multilineIndent = 0;
    let arrayKey = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines and comments (unless in multiline mode)
        if (!multilineValue && (line.trim() === '' || line.trim().startsWith('#'))) {
            continue;
        }

        // Handle multiline string continuation
        if (multilineValue !== null) {
            const stripped = line;
            const indent = stripped.length - stripped.trimStart().length;
            if (indent >= multilineIndent && stripped.trim() !== '') {
                if (result[currentKey] === '') {
                    result[currentKey] = stripped.trimStart();
                } else {
                    result[currentKey] += '\n' + stripped.trimStart();
                }
                continue;
            } else {
                // End of multiline
                multilineValue = null;
                // Fall through to process this line normally
                if (line.trim() === '') continue;
            }
        }

        // Handle array items
        const arrayMatch = line.match(/^(\s+)- (.+)$/);
        if (arrayMatch && arrayKey) {
            if (!Array.isArray(result[arrayKey])) {
                result[arrayKey] = [];
            }
            result[arrayKey].push(parseYAMLValue(arrayMatch[2].trim()));
            continue;
        }

        // Handle key-value pairs
        const kvMatch = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i);
        if (kvMatch) {
            const key = kvMatch[1];
            const rawValue = kvMatch[2].trim();

            // Check for multiline indicator
            if (rawValue === '|' || rawValue === '>') {
                currentKey = key;
                multilineValue = '';
                multilineIndent = 2; // expect at least 2-space indent
                result[key] = '';
                arrayKey = null;
                continue;
            }

            // Check if next line starts an array
            if (rawValue === '' && i + 1 < lines.length && lines[i + 1].match(/^\s+- /)) {
                arrayKey = key;
                result[key] = [];
                continue;
            }

            result[key] = parseYAMLValue(rawValue);
            currentKey = key;
            arrayKey = null;
        }
    }

    return result;
}

/**
 * Parse a single YAML value (string, number, boolean, null).
 */
function parseYAMLValue(raw) {
    if (raw === '' || raw === 'null' || raw === '~') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    // Quoted strings
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        return raw.slice(1, -1);
    }

    // Numbers
    if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
    if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);

    return raw;
}

class PluginLoader {
    /**
     * Create a new PluginLoader.
     * @param {string} pluginsDir - Path to plugins directory (default: .loki/plugins)
     * @param {string} [schemasDir] - Path to schemas directory
     */
    constructor(pluginsDir, schemasDir) {
        this.pluginsDir = pluginsDir || '.loki/plugins';
        this.validator = new PluginValidator(schemasDir);
        this._watchers = [];
    }

    /**
     * Discover plugin files in the plugins directory.
     * @returns {string[]} Array of file paths
     */
    discover() {
        if (!existsSync(this.pluginsDir)) {
            return [];
        }

        try {
            const stat = statSync(this.pluginsDir);
            if (!stat.isDirectory()) {
                return [];
            }
        } catch {
            return [];
        }

        try {
            const entries = readdirSync(this.pluginsDir);
            const pluginFiles = [];

            for (const entry of entries) {
                const ext = extname(entry).toLowerCase();
                if (ext === '.yaml' || ext === '.yml' || ext === '.json') {
                    pluginFiles.push(join(this.pluginsDir, entry));
                }
            }

            return pluginFiles.sort();
        } catch {
            return [];
        }
    }

    /**
     * Parse a plugin file (YAML or JSON).
     * @param {string} filePath - Path to the plugin file
     * @returns {object|null} Parsed config or null on error
     */
    _parseFile(filePath) {
        try {
            const content = readFileSync(filePath, 'utf8');
            const ext = extname(filePath).toLowerCase();

            if (ext === '.json') {
                return JSON.parse(content);
            }

            // YAML parsing
            return parseSimpleYAML(content);
        } catch (err) {
            return null;
        }
    }

    /**
     * Load all plugins from the plugins directory.
     * @returns {{ loaded: Array<{path: string, config: object}>, failed: Array<{path: string, errors: string[]}> }}
     */
    loadAll() {
        const files = this.discover();
        const loaded = [];
        const failed = [];

        for (const filePath of files) {
            try {
                const config = this._parseFile(filePath);

                if (!config) {
                    failed.push({ path: filePath, errors: ['Failed to parse plugin file'] });
                    continue;
                }

                const result = this.validator.validate(config);

                if (result.valid) {
                    loaded.push({ path: filePath, config });
                } else {
                    failed.push({ path: filePath, errors: result.errors });
                }
            } catch (err) {
                failed.push({ path: filePath, errors: [err.message || 'Unknown error'] });
            }
        }

        return { loaded, failed };
    }

    /**
     * Load a single plugin file.
     * @param {string} filePath - Path to the plugin file
     * @returns {{ config: object|null, errors: string[] }}
     */
    loadOne(filePath) {
        const config = this._parseFile(filePath);

        if (!config) {
            return { config: null, errors: ['Failed to parse plugin file'] };
        }

        const result = this.validator.validate(config);

        if (result.valid) {
            return { config, errors: [] };
        }

        return { config: null, errors: result.errors };
    }

    /**
     * Watch the plugins directory for changes.
     * @param {function} callback - Called with (eventType, filePath) on changes
     * @returns {function} Cleanup function to stop watching
     */
    watchForChanges(callback) {
        if (!existsSync(this.pluginsDir)) {
            return () => {};
        }

        try {
            const watcher = watch(this.pluginsDir, (eventType, filename) => {
                if (!filename) return;

                const ext = extname(filename).toLowerCase();
                if (ext === '.yaml' || ext === '.yml' || ext === '.json') {
                    const filePath = join(this.pluginsDir, filename);
                    callback(eventType, filePath);
                }
            });

            this._watchers.push(watcher);

            return () => {
                watcher.close();
                const idx = this._watchers.indexOf(watcher);
                if (idx >= 0) this._watchers.splice(idx, 1);
            };
        } catch {
            return () => {};
        }
    }

    /**
     * Stop all file watchers.
     */
    stopWatching() {
        for (const watcher of this._watchers) {
            try { watcher.close(); } catch { /* ignore */ }
        }
        this._watchers = [];
    }
}

module.exports = { PluginLoader, parseSimpleYAML, parseYAMLValue };
