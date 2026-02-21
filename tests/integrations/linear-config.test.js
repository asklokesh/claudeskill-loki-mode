'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  loadConfig,
  validateConfig,
  parseSimpleYaml,
  DEFAULT_STATUS_MAPPING,
} = require('../../src/integrations/linear/config');

// Create temp directories for testing config loading
let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-linear-config-'));
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('parseSimpleYaml', () => {
  it('parses flat key-value pairs', () => {
    const result = parseSimpleYaml('name: test\nversion: 1');
    assert.equal(result.name, 'test');
    assert.equal(result.version, 1);
  });

  it('parses nested objects', () => {
    const yaml = `integrations:
  linear:
    api_key: lin_api_abc123
    team_id: team-x`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result.integrations.linear.api_key, 'lin_api_abc123');
    assert.equal(result.integrations.linear.team_id, 'team-x');
  });

  it('handles quoted strings', () => {
    const yaml = `key1: "hello world"\nkey2: 'single quoted'`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result.key1, 'hello world');
    assert.equal(result.key2, 'single quoted');
  });

  it('handles booleans', () => {
    const result = parseSimpleYaml('enabled: true\ndisabled: false');
    assert.equal(result.enabled, true);
    assert.equal(result.disabled, false);
  });

  it('handles integers', () => {
    const result = parseSimpleYaml('count: 42');
    assert.equal(result.count, 42);
  });

  it('ignores comments', () => {
    const yaml = `# This is a comment\nkey: value # inline comment`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result.key, 'value');
  });

  it('ignores empty lines', () => {
    const yaml = `key1: a\n\n\nkey2: b`;
    const result = parseSimpleYaml(yaml);
    assert.equal(result.key1, 'a');
    assert.equal(result.key2, 'b');
  });
});

describe('loadConfig', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns null when no config file exists', () => {
    const result = loadConfig(tmpDir);
    assert.equal(result, null);
  });

  it('returns null when config has no integrations section', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), 'name: test\n');
    const result = loadConfig(tmpDir);
    assert.equal(result, null);
  });

  it('returns null when integrations has no linear section', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), 'integrations:\n  jira:\n    url: test\n');
    const result = loadConfig(tmpDir);
    assert.equal(result, null);
  });

  it('loads valid YAML config', () => {
    const yaml = `integrations:
  linear:
    api_key: lin_api_test123
    team_id: team-eng
    webhook_secret: whsec_abc`;
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), yaml);

    const config = loadConfig(tmpDir);
    assert.equal(config.apiKey, 'lin_api_test123');
    assert.equal(config.teamId, 'team-eng');
    assert.equal(config.webhookSecret, 'whsec_abc');
    assert.deepEqual(config.statusMapping, DEFAULT_STATUS_MAPPING);
  });

  it('loads JSON config as fallback', () => {
    const json = {
      integrations: {
        linear: {
          api_key: 'lin_api_json',
          team_id: 'team-json',
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(json));

    const config = loadConfig(tmpDir);
    assert.equal(config.apiKey, 'lin_api_json');
    assert.equal(config.teamId, 'team-json');
  });

  it('prefers YAML over JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), `integrations:
  linear:
    api_key: from_yaml`);
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({
      integrations: { linear: { api_key: 'from_json' } },
    }));

    const config = loadConfig(tmpDir);
    assert.equal(config.apiKey, 'from_yaml');
  });

  it('throws when api_key is missing', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), `integrations:
  linear:
    team_id: team-x`);

    assert.throws(() => loadConfig(tmpDir), { message: /api_key/ });
  });

  it('sets optional fields to null when missing', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), `integrations:
  linear:
    api_key: lin_api_minimal`);

    const config = loadConfig(tmpDir);
    assert.equal(config.teamId, null);
    assert.equal(config.webhookSecret, null);
  });
});

describe('validateConfig', () => {
  it('validates a correct config', () => {
    const result = validateConfig({
      apiKey: 'lin_api_test',
      teamId: 'team-1',
      webhookSecret: null,
      statusMapping: DEFAULT_STATUS_MAPPING,
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects null config', () => {
    const result = validateConfig(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('null'));
  });

  it('rejects missing apiKey', () => {
    const result = validateConfig({
      apiKey: '',
      teamId: null,
      webhookSecret: null,
      statusMapping: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('apiKey')));
  });

  it('rejects invalid teamId type', () => {
    const result = validateConfig({
      apiKey: 'key',
      teamId: 123,
      webhookSecret: null,
      statusMapping: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('teamId')));
  });

  it('rejects missing statusMapping', () => {
    const result = validateConfig({
      apiKey: 'key',
      teamId: null,
      webhookSecret: null,
      statusMapping: null,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('statusMapping')));
  });
});

describe('DEFAULT_STATUS_MAPPING', () => {
  it('maps all RARV phases', () => {
    assert.equal(DEFAULT_STATUS_MAPPING.REASON, 'In Progress');
    assert.equal(DEFAULT_STATUS_MAPPING.ACT, 'In Progress');
    assert.equal(DEFAULT_STATUS_MAPPING.REFLECT, 'In Review');
    assert.equal(DEFAULT_STATUS_MAPPING.VERIFY, 'Done');
    assert.equal(DEFAULT_STATUS_MAPPING.DONE, 'Done');
  });
});
