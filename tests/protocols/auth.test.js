'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { OAuthValidator } = require('../../src/protocols/auth/oauth');

let testDir;
const origCwd = process.cwd();

before(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-auth-test-'));
  process.chdir(testDir);
  // Remove any env var that might affect tests
  delete process.env.MCP_AUTH_TOKEN;
  delete process.env.MCP_AUTH_SCOPE;
});

after(() => {
  process.chdir(origCwd);
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('OAuthValidator - disabled mode', () => {
  it('should be disabled when no config exists', () => {
    const auth = new OAuthValidator();
    assert.equal(auth.enabled, false);
  });

  it('should allow all requests when disabled', () => {
    const auth = new OAuthValidator();
    const result = auth.validate({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'loki/start-project' },
      id: 1
    });
    assert.ok(result.valid);
    assert.equal(result.scope, '*');
  });

  it('should allow all tokens when disabled', () => {
    const auth = new OAuthValidator();
    const result = auth.validateToken('any-token');
    assert.ok(result.valid);
  });
});

describe('OAuthValidator - enabled mode', () => {
  it('should enable via issueToken', () => {
    const auth = new OAuthValidator();
    // Auth is disabled initially, but we can manually enable
    auth.registerClient('test-client', { scopes: ['*'] });
    assert.equal(auth.enabled, true);
  });

  it('should validate issued tokens', () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });
    const { token } = auth.issueToken('tools:*', 60000);

    const result = auth.validateToken(token);
    assert.ok(result.valid);
    assert.equal(result.scope, 'tools:*');
  });

  it('should reject invalid tokens', () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });
    auth.issueToken('*', 60000);

    const result = auth.validateToken('invalid-token-value');
    assert.equal(result.valid, false);
    assert.ok(result.error);
  });

  it('should reject expired tokens', async () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });
    // Issue token with 1ms TTL
    const { token } = auth.issueToken('*', 1);

    // Wait for expiry
    await new Promise((r) => setTimeout(r, 10));

    const result = auth.validateToken(token);
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('expired'));
  });

  it('should revoke tokens', () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });
    const { token } = auth.issueToken('*', 60000);

    assert.ok(auth.validateToken(token).valid);
    auth.revokeToken(token);
    assert.equal(auth.validateToken(token).valid, false);
  });

  it('should validate from request params._meta.authorization', () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });
    const { token } = auth.issueToken('*', 60000);

    const result = auth.validate({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'loki/start-project',
        _meta: { authorization: 'Bearer ' + token }
      },
      id: 1
    });
    assert.ok(result.valid);
  });

  it('should reject requests without authorization when enabled', () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });

    const result = auth.validate({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'loki/start-project' },
      id: 1
    });
    assert.equal(result.valid, false);
  });

  it('should validate HTTP Authorization header', () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });
    const { token } = auth.issueToken('*', 60000);

    const result = auth.validateHeader('Bearer ' + token);
    assert.ok(result.valid);
  });

  it('should reject invalid Authorization header format', () => {
    const auth = new OAuthValidator();
    auth.registerClient('test-client', { scopes: ['*'] });

    const result = auth.validateHeader('Basic dXNlcjpwYXNz');
    assert.equal(result.valid, false);
  });
});

describe('OAuthValidator - PKCE', () => {
  it('should validate correct PKCE code challenge (S256)', () => {
    const crypto = require('crypto');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    const auth = new OAuthValidator();
    assert.ok(auth.validatePKCE(verifier, challenge));
  });

  it('should reject incorrect PKCE code challenge', () => {
    const auth = new OAuthValidator();
    assert.equal(auth.validatePKCE('wrong-verifier', 'wrong-challenge'), false);
  });

  it('should reject empty PKCE values', () => {
    const auth = new OAuthValidator();
    assert.equal(auth.validatePKCE('', ''), false);
    assert.equal(auth.validatePKCE(null, null), false);
  });
});

describe('OAuthValidator - config file', () => {
  it('should load config from file', () => {
    const configDir = path.join(testDir, '.loki');
    fs.mkdirSync(configDir, { recursive: true });
    const config = {
      enabled: true,
      clients: [{ id: 'my-app', secret: 'secret123', scopes: ['tools:*'] }],
      tokens: [{ value: 'static-token-abc', scope: 'tools:read' }]
    };
    fs.writeFileSync(
      path.join(configDir, 'mcp-auth.json'),
      JSON.stringify(config),
      'utf8'
    );

    const auth = new OAuthValidator({ configPath: path.join(configDir, 'mcp-auth.json') });
    assert.equal(auth.enabled, true);
    const result = auth.validateToken('static-token-abc');
    assert.ok(result.valid);
    assert.equal(result.scope, 'tools:read');
  });

  it('should handle missing config file gracefully', () => {
    const auth = new OAuthValidator({ configPath: '/nonexistent/path.json' });
    assert.equal(auth.enabled, false);
  });
});

describe('OAuthValidator - environment variable', () => {
  it('should enable auth via MCP_AUTH_TOKEN env var', () => {
    process.env.MCP_AUTH_TOKEN = 'env-token-xyz';
    // Create a new temp dir without config file
    const envTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-auth-env-'));
    const savedCwd = process.cwd();
    process.chdir(envTestDir);

    try {
      const auth = new OAuthValidator();
      assert.equal(auth.enabled, true);
      const result = auth.validateToken('env-token-xyz');
      assert.ok(result.valid);
    } finally {
      process.chdir(savedCwd);
      delete process.env.MCP_AUTH_TOKEN;
      fs.rmSync(envTestDir, { recursive: true, force: true });
    }
  });
});

describe('OAuthValidator - MCP server integration', () => {
  it('should block tool calls when auth is enabled and no token provided', () => {
    // Set up auth config
    const configDir = path.join(testDir, '.loki');
    fs.mkdirSync(configDir, { recursive: true });
    const config = {
      enabled: true,
      clients: [{ id: 'test', scopes: ['*'] }],
      tokens: [{ value: 'valid-token', scope: '*' }]
    };
    fs.writeFileSync(
      path.join(configDir, 'mcp-auth.json'),
      JSON.stringify(config),
      'utf8'
    );

    const auth = new OAuthValidator({ configPath: path.join(configDir, 'mcp-auth.json') });
    assert.equal(auth.enabled, true);

    // Request without token
    const result = auth.validate({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'loki/start-project', arguments: { prd: 'test' } },
      id: 1
    });
    assert.equal(result.valid, false);

    // Request with valid token
    const result2 = auth.validate({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'loki/start-project',
        arguments: { prd: 'test' },
        _meta: { authorization: 'Bearer valid-token' }
      },
      id: 2
    });
    assert.ok(result2.valid);
  });
});
