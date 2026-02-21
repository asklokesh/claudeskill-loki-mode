'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Default RARV-to-Linear status mapping.
 */
const DEFAULT_STATUS_MAPPING = {
  REASON: 'In Progress',
  ACT: 'In Progress',
  REFLECT: 'In Review',
  VERIFY: 'Done',
  DONE: 'Done',
};

/**
 * Minimal YAML parser for flat and one-level-nested key-value pairs.
 * Handles the subset of YAML used by .loki/config.yaml without external deps.
 * Supports: string values, nested objects (2-space indent), comments, quoted strings.
 */
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  let currentSection = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trimEnd();
    if (!line.trim()) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let value = kvMatch[2].trim();

    if (indent === 0 || indent === 2 && currentSection === null) {
      if (value === '' || value === '{}') {
        // Section header
        currentSection = key;
        result[key] = result[key] || {};
      } else {
        currentSection = null;
        result[key] = unquote(value);
      }
    } else if (indent >= 2 && currentSection) {
      const parts = currentSection.split('.');
      if (value === '' || value === '{}') {
        // Nested section: e.g., integrations.linear
        currentSection = parts.concat(key).join('.');
        setNested(result, parts.concat(key), {});
      } else {
        setNested(result, parts.concat(key), unquote(value));
      }
    }
  }

  return result;
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return s;
}

function setNested(obj, keys, value) {
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof current[keys[i]] !== 'object' || current[keys[i]] === null) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  if (typeof value === 'object' && typeof current[lastKey] === 'object') {
    // Merge, don't overwrite
    Object.assign(current[lastKey], value);
  } else {
    current[lastKey] = value;
  }
}

/**
 * Load Linear integration configuration.
 * Returns null if no config exists or if the linear section is absent,
 * ensuring zero overhead when the integration is not configured.
 *
 * @param {string} [configDir] - Directory containing config.yaml (defaults to .loki/)
 * @returns {object|null} Configuration object or null
 */
function loadConfig(configDir) {
  const dir = configDir || path.join(process.cwd(), '.loki');
  const yamlPath = path.join(dir, 'config.yaml');
  const jsonPath = path.join(dir, 'config.json');

  let raw = null;
  let parsed = null;

  // Try YAML first, then JSON
  if (fs.existsSync(yamlPath)) {
    raw = fs.readFileSync(yamlPath, 'utf8');
    parsed = parseSimpleYaml(raw);
  } else if (fs.existsSync(jsonPath)) {
    raw = fs.readFileSync(jsonPath, 'utf8');
    parsed = JSON.parse(raw);
  }

  if (!parsed) return null;

  // Navigate to integrations.linear
  const integrations = parsed.integrations;
  if (!integrations || typeof integrations !== 'object') return null;

  const linear = integrations.linear;
  if (!linear || typeof linear !== 'object') return null;

  // Validate required fields
  if (!linear.api_key) {
    throw new Error('Linear integration config requires "api_key" field');
  }

  return {
    apiKey: linear.api_key,
    teamId: linear.team_id || null,
    webhookSecret: linear.webhook_secret || null,
    statusMapping: Object.assign({}, DEFAULT_STATUS_MAPPING, linear.status_mapping || {}),
  };
}

/**
 * Validate a configuration object.
 * @param {object} config
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateConfig(config) {
  const errors = [];
  if (!config) {
    return { valid: false, errors: ['Config is null'] };
  }
  if (!config.apiKey || typeof config.apiKey !== 'string') {
    errors.push('apiKey is required and must be a string');
  }
  if (config.teamId !== null && typeof config.teamId !== 'string') {
    errors.push('teamId must be a string or null');
  }
  if (config.webhookSecret !== null && typeof config.webhookSecret !== 'string') {
    errors.push('webhookSecret must be a string or null');
  }
  if (!config.statusMapping || typeof config.statusMapping !== 'object') {
    errors.push('statusMapping must be an object');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  loadConfig,
  validateConfig,
  parseSimpleYaml,
  DEFAULT_STATUS_MAPPING,
};
