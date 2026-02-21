'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  Decision,
  validatePreExecution,
  validatePreDeployment,
  validateResource,
  validateData,
  validateApprovalGate,
  evaluateRule,
  scanContent,
} = require('../../src/policies/types');

// -------------------------------------------------------------------
// Tests: Decision constants
// -------------------------------------------------------------------

describe('Decision constants', function () {
  it('should have ALLOW, DENY, REQUIRE_APPROVAL', function () {
    assert.strictEqual(Decision.ALLOW, 'ALLOW');
    assert.strictEqual(Decision.DENY, 'DENY');
    assert.strictEqual(Decision.REQUIRE_APPROVAL, 'REQUIRE_APPROVAL');
  });
});

// -------------------------------------------------------------------
// Tests: validatePreExecution
// -------------------------------------------------------------------

describe('validatePreExecution', function () {
  it('should accept valid entry', function () {
    const result = validatePreExecution({
      name: 'sandbox-files',
      rule: 'file_path must start with project_dir',
      action: 'deny',
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should reject missing name', function () {
    const result = validatePreExecution({ rule: 'test', action: 'deny' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(function (e) { return e.includes('name'); }));
  });

  it('should reject missing rule', function () {
    const result = validatePreExecution({ name: 'test', action: 'deny' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(function (e) { return e.includes('rule'); }));
  });

  it('should reject invalid action', function () {
    const result = validatePreExecution({ name: 'test', rule: 'test', action: 'invalid' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(function (e) { return e.includes('action'); }));
  });

  it('should reject non-object input', function () {
    const result = validatePreExecution(null);
    assert.strictEqual(result.valid, false);
  });

  it('should accept require_approval action', function () {
    const result = validatePreExecution({
      name: 'test',
      rule: 'test',
      action: 'require_approval',
    });
    assert.strictEqual(result.valid, true);
  });
});

// -------------------------------------------------------------------
// Tests: validatePreDeployment
// -------------------------------------------------------------------

describe('validatePreDeployment', function () {
  it('should accept valid entry', function () {
    const result = validatePreDeployment({
      name: 'quality-gates',
      gates: ['static-analysis', 'test-coverage'],
    });
    assert.strictEqual(result.valid, true);
  });

  it('should reject empty gates array', function () {
    const result = validatePreDeployment({ name: 'test', gates: [] });
    assert.strictEqual(result.valid, false);
  });

  it('should reject missing gates', function () {
    const result = validatePreDeployment({ name: 'test' });
    assert.strictEqual(result.valid, false);
  });
});

// -------------------------------------------------------------------
// Tests: validateResource
// -------------------------------------------------------------------

describe('validateResource', function () {
  it('should accept valid token budget entry', function () {
    const result = validateResource({
      name: 'token-budget',
      max_tokens: 1000000,
      alerts: [50, 80, 100],
      on_exceed: 'shutdown',
    });
    assert.strictEqual(result.valid, true);
  });

  it('should accept valid provider restriction entry', function () {
    const result = validateResource({
      name: 'approved-providers',
      providers: ['claude', 'openai'],
      action: 'deny',
    });
    assert.strictEqual(result.valid, true);
  });

  it('should reject negative max_tokens', function () {
    const result = validateResource({ name: 'test', max_tokens: -100 });
    assert.strictEqual(result.valid, false);
  });

  it('should reject non-array alerts', function () {
    const result = validateResource({ name: 'test', alerts: 'fifty' });
    assert.strictEqual(result.valid, false);
  });

  it('should reject alert values outside 0-100', function () {
    const result = validateResource({ name: 'test', alerts: [150] });
    assert.strictEqual(result.valid, false);
  });

  it('should reject invalid on_exceed', function () {
    const result = validateResource({ name: 'test', on_exceed: 'explode' });
    assert.strictEqual(result.valid, false);
  });

  it('should reject empty providers array', function () {
    const result = validateResource({ name: 'test', providers: [] });
    assert.strictEqual(result.valid, false);
  });
});

// -------------------------------------------------------------------
// Tests: validateData
// -------------------------------------------------------------------

describe('validateData', function () {
  it('should accept secret_detection type', function () {
    const result = validateData({
      name: 'secret-scan',
      type: 'secret_detection',
    });
    assert.strictEqual(result.valid, true);
  });

  it('should accept pii_scanning type', function () {
    const result = validateData({
      name: 'pii-scan',
      type: 'pii_scanning',
    });
    assert.strictEqual(result.valid, true);
  });

  it('should reject unknown type', function () {
    const result = validateData({ name: 'test', type: 'unknown' });
    assert.strictEqual(result.valid, false);
  });

  it('should reject non-array patterns', function () {
    const result = validateData({ name: 'test', type: 'secret_detection', patterns: 'not-array' });
    assert.strictEqual(result.valid, false);
  });
});

// -------------------------------------------------------------------
// Tests: validateApprovalGate
// -------------------------------------------------------------------

describe('validateApprovalGate', function () {
  it('should accept valid gate', function () {
    const result = validateApprovalGate({
      name: 'pre-deploy',
      phase: 'deploy',
      timeout_minutes: 30,
      webhook: 'https://hooks.slack.com/test',
    });
    assert.strictEqual(result.valid, true);
  });

  it('should reject missing phase', function () {
    const result = validateApprovalGate({ name: 'test' });
    assert.strictEqual(result.valid, false);
  });

  it('should reject negative timeout', function () {
    const result = validateApprovalGate({ name: 'test', phase: 'deploy', timeout_minutes: -5 });
    assert.strictEqual(result.valid, false);
  });

  it('should reject empty webhook', function () {
    const result = validateApprovalGate({ name: 'test', phase: 'deploy', webhook: '' });
    assert.strictEqual(result.valid, false);
  });
});

// -------------------------------------------------------------------
// Tests: evaluateRule
// -------------------------------------------------------------------

describe('evaluateRule', function () {
  it('should evaluate file_path rule - PASS', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/home/project/src/index.js',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, true);
  });

  it('should evaluate file_path rule - FAIL', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/etc/passwd',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, false);
  });

  it('should evaluate active_agents rule - PASS', function () {
    const result = evaluateRule('active_agents <= 10', {
      active_agents: 5,
    });
    assert.strictEqual(result, true);
  });

  it('should evaluate active_agents rule - FAIL', function () {
    const result = evaluateRule('active_agents <= 5', {
      active_agents: 10,
    });
    assert.strictEqual(result, false);
  });

  it('should return null for unknown rules', function () {
    const result = evaluateRule('custom_check == true', { custom_check: true });
    assert.strictEqual(result, null);
  });

  it('should return null for null input', function () {
    assert.strictEqual(evaluateRule(null, {}), null);
    assert.strictEqual(evaluateRule('test', null), null);
  });
});

// -------------------------------------------------------------------
// Tests: scanContent
// -------------------------------------------------------------------

describe('scanContent', function () {
  it('should detect API keys', function () {
    const findings = scanContent('const key = "sk-1234567890abcdef1234567890abcdef"', 'secret_detection');
    assert.ok(findings.length > 0);
  });

  it('should detect private keys', function () {
    const findings = scanContent('-----BEGIN RSA PRIVATE KEY-----', 'secret_detection');
    assert.ok(findings.length > 0);
  });

  it('should detect GitHub PATs', function () {
    const findings = scanContent('token: ghp_abcdef1234567890abcdef1234567890abcdef', 'secret_detection');
    assert.ok(findings.length > 0);
  });

  it('should detect email addresses (PII)', function () {
    const findings = scanContent('Contact user@example.com for details', 'pii_scanning');
    assert.ok(findings.length > 0);
  });

  it('should detect SSN patterns (PII)', function () {
    const findings = scanContent('SSN: 123-45-6789', 'pii_scanning');
    assert.ok(findings.length > 0);
  });

  it('should return empty array for clean content', function () {
    const findings = scanContent('const greeting = "hello world";', 'secret_detection');
    assert.strictEqual(findings.length, 0);
  });

  it('should return empty array for null content', function () {
    assert.strictEqual(scanContent(null, 'secret_detection').length, 0);
    assert.strictEqual(scanContent('', 'secret_detection').length, 0);
  });
});

// -------------------------------------------------------------------
// Tests: path traversal bypass fix (Finding 1)
// -------------------------------------------------------------------

describe('evaluateRule - path traversal security', function () {
  it('should block path traversal with ../ sequences', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/home/project/../../../etc/passwd',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, false, 'Path traversal via ../ must be blocked');
  });

  it('should block sibling directory bypass (/home/project-evil)', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/home/project-evil/secret.js',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, false, 'Sibling directory /project-evil must not match /project prefix');
  });

  it('should allow exact match on project_dir itself', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/home/project',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, true);
  });

  it('should allow a file directly in project_dir', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/home/project/main.js',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, true);
  });

  it('should allow nested subdirectory files', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/home/project/src/lib/utils.js',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, true);
  });

  it('should block /etc/passwd regardless of project_dir', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/etc/passwd',
      project_dir: '/home/project',
    });
    assert.strictEqual(result, false);
  });

  it('should block traversal when project_dir itself ends with separator', function () {
    const result = evaluateRule('file_path must start with project_dir', {
      file_path: '/home/project/../etc/passwd',
      project_dir: '/home/project/',
    });
    assert.strictEqual(result, false);
  });
});

// -------------------------------------------------------------------
// Tests: validateApprovalGate - webhook URL validation (SSRF fix)
// -------------------------------------------------------------------

describe('validateApprovalGate - webhook URL validation', function () {
  it('should accept https webhook URL', function () {
    const result = validateApprovalGate({
      name: 'gate',
      phase: 'deploy',
      webhook: 'https://hooks.example.com/notify',
    });
    assert.strictEqual(result.valid, true);
  });

  it('should accept http webhook URL', function () {
    const result = validateApprovalGate({
      name: 'gate',
      phase: 'deploy',
      webhook: 'http://hooks.example.com/notify',
    });
    assert.strictEqual(result.valid, true);
  });

  it('should reject file:// webhook URL', function () {
    const result = validateApprovalGate({
      name: 'gate',
      phase: 'deploy',
      webhook: 'file:///etc/passwd',
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(function (e) { return e.includes('http') || e.includes('protocol'); }));
  });

  it('should reject gopher:// webhook URL', function () {
    const result = validateApprovalGate({
      name: 'gate',
      phase: 'deploy',
      webhook: 'gopher://evil.example.com/',
    });
    assert.strictEqual(result.valid, false);
  });

  it('should reject malformed webhook URL', function () {
    const result = validateApprovalGate({
      name: 'gate',
      phase: 'deploy',
      webhook: 'not-a-url',
    });
    assert.strictEqual(result.valid, false);
  });
});
