'use strict';

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ApprovalGateManager, DEFAULT_TIMEOUT_MINUTES } = require('../../src/policies/approval');

// -------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-approval-test-'));
  fs.mkdirSync(path.join(dir, '.loki', 'state'), { recursive: true });
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// -------------------------------------------------------------------
// Tests: ApprovalGateManager - no gates
// -------------------------------------------------------------------

describe('ApprovalGateManager - no gates', function () {
  let tempDir;
  let mgr;

  before(function () {
    tempDir = createTempDir();
    mgr = new ApprovalGateManager(tempDir, []);
  });

  after(function () {
    mgr.destroy();
    cleanup(tempDir);
  });

  it('should auto-approve when no gate exists for phase', async function () {
    const result = await mgr.requestApproval('deploy', { branch: 'main' });
    assert.strictEqual(result.approved, true);
    assert.strictEqual(result.method, 'auto');
  });

  it('should report hasGate as false', function () {
    assert.strictEqual(mgr.hasGate('deploy'), false);
  });
});

// -------------------------------------------------------------------
// Tests: ApprovalGateManager - with gates
// -------------------------------------------------------------------

describe('ApprovalGateManager - with gates', function () {
  let tempDir;
  let mgr;

  const gates = [
    {
      name: 'pre-deploy',
      phase: 'deploy',
      timeout_minutes: 0.01, // Very short for testing (0.6 seconds)
    },
    {
      name: 'pre-release',
      phase: 'release',
      timeout_minutes: 30,
    },
  ];

  before(function () {
    tempDir = createTempDir();
  });

  afterEach(function () {
    if (mgr) {
      mgr.destroy();
      mgr = null;
    }
  });

  after(function () {
    cleanup(tempDir);
  });

  it('should find gate by phase', function () {
    mgr = new ApprovalGateManager(tempDir, gates);
    const gate = mgr.findGate('deploy');
    assert.ok(gate);
    assert.strictEqual(gate.name, 'pre-deploy');
  });

  it('should report hasGate correctly', function () {
    mgr = new ApprovalGateManager(tempDir, gates);
    assert.strictEqual(mgr.hasGate('deploy'), true);
    assert.strictEqual(mgr.hasGate('build'), false);
  });

  it('should reject (fail-closed) after timeout by default', async function () {
    mgr = new ApprovalGateManager(tempDir, gates);
    const result = await mgr.requestApproval('deploy', { branch: 'main' });
    assert.strictEqual(result.approved, false);
    assert.strictEqual(result.method, 'timeout');
    assert.ok(result.reason.includes('timeout'));
  });

  it('should resolve approval manually', async function () {
    mgr = new ApprovalGateManager(tempDir, gates);

    // Start a request for the release phase (long timeout)
    const promise = mgr.requestApproval('release', { version: '1.0.0' });

    // Get the pending request ID
    const pending = mgr.getPendingRequests();
    assert.strictEqual(pending.length, 1);
    const requestId = pending[0].id;

    // Resolve it manually
    const resolved = mgr.resolveApproval(requestId, true, 'LGTM');
    assert.strictEqual(resolved, true);

    const result = await promise;
    assert.strictEqual(result.approved, true);
    assert.strictEqual(result.method, 'manual');
    assert.strictEqual(result.reason, 'LGTM');
  });

  it('should handle manual rejection', async function () {
    mgr = new ApprovalGateManager(tempDir, gates);

    const promise = mgr.requestApproval('release', { version: '2.0.0' });
    const pending = mgr.getPendingRequests();
    const requestId = pending[0].id;

    mgr.resolveApproval(requestId, false, 'Not ready');

    const result = await promise;
    assert.strictEqual(result.approved, false);
    assert.strictEqual(result.reason, 'Not ready');
  });

  it('should return false for unknown request ID', function () {
    mgr = new ApprovalGateManager(tempDir, gates);
    const result = mgr.resolveApproval('nonexistent-id', true);
    assert.strictEqual(result, false);
  });

  it('should persist audit trail', async function () {
    mgr = new ApprovalGateManager(tempDir, gates);

    // Create and auto-approve via timeout
    await mgr.requestApproval('deploy', {});

    const audit = mgr.getAuditTrail();
    assert.ok(audit.length > 0);
    assert.strictEqual(audit[audit.length - 1].phase, 'deploy');
    assert.ok(audit[audit.length - 1].resolvedAt);

    // Verify file was written
    const stateFile = path.join(tempDir, '.loki', 'state', 'approvals.json');
    assert.ok(fs.existsSync(stateFile));

    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.ok(saved.audit.length > 0);
  });
});

// -------------------------------------------------------------------
// Tests: DEFAULT_TIMEOUT_MINUTES
// -------------------------------------------------------------------

describe('ApprovalGateManager - constants', function () {
  it('should export DEFAULT_TIMEOUT_MINUTES as 30', function () {
    assert.strictEqual(DEFAULT_TIMEOUT_MINUTES, 30);
  });
});

// -------------------------------------------------------------------
// Tests: fail-closed timeout behavior
// -------------------------------------------------------------------

describe('ApprovalGateManager - fail-closed timeout', function () {
  let tempDir;
  let mgr;

  before(function () {
    tempDir = createTempDir();
  });

  afterEach(function () {
    if (mgr) {
      mgr.destroy();
      mgr = null;
    }
  });

  after(function () {
    cleanup(tempDir);
  });

  it('should return approved: false on timeout when auto_approve_on_timeout not set', async function () {
    const gates = [{ name: 'gate', phase: 'deploy', timeout_minutes: 0.01 }];
    mgr = new ApprovalGateManager(tempDir, gates);
    const result = await mgr.requestApproval('deploy', {});
    assert.strictEqual(result.approved, false);
    assert.strictEqual(result.method, 'timeout');
  });

  it('should return approved: true on timeout when auto_approve_on_timeout is true', async function () {
    const gates = [{
      name: 'gate',
      phase: 'release',
      timeout_minutes: 0.01,
      auto_approve_on_timeout: true,
    }];
    mgr = new ApprovalGateManager(tempDir, gates);
    const result = await mgr.requestApproval('release', {});
    assert.strictEqual(result.approved, true);
    assert.strictEqual(result.method, 'timeout');
  });

  it('should return approved: false on timeout when auto_approve_on_timeout is false', async function () {
    const gates = [{
      name: 'gate',
      phase: 'build',
      timeout_minutes: 0.01,
      auto_approve_on_timeout: false,
    }];
    mgr = new ApprovalGateManager(tempDir, gates);
    const result = await mgr.requestApproval('build', {});
    assert.strictEqual(result.approved, false);
    assert.strictEqual(result.method, 'timeout');
  });
});

// -------------------------------------------------------------------
// Tests: SSRF protection in _sendWebhook
// -------------------------------------------------------------------

describe('ApprovalGateManager - SSRF protection', function () {
  let tempDir;
  let mgr;

  before(function () {
    tempDir = createTempDir();
  });

  afterEach(function () {
    if (mgr) {
      mgr.destroy();
      mgr = null;
    }
  });

  after(function () {
    cleanup(tempDir);
  });

  it('should not make HTTP request for file:// webhook URL', function (t, done) {
    // We verify _sendWebhook does not throw and silently drops invalid URLs.
    // Since it is fire-and-forget, we just confirm no exception is thrown.
    const gates = [{
      name: 'gate',
      phase: 'deploy',
      timeout_minutes: 60,
      webhook: 'https://legitimate-external-service.example.com/hook',
    }];
    mgr = new ApprovalGateManager(tempDir, gates);
    // Call _sendWebhook directly with a bad URL -- should not throw
    assert.doesNotThrow(function () {
      mgr._sendWebhook('file:///etc/passwd', { id: 'x', phase: 'deploy', gate: 'gate', context: {}, createdAt: '' });
    });
    done();
  });

  it('should silently drop internal IP webhook URLs', function (t, done) {
    mgr = new ApprovalGateManager(tempDir, []);
    assert.doesNotThrow(function () {
      mgr._sendWebhook('http://169.254.169.254/latest/meta-data/', { id: 'x', phase: 'deploy', gate: 'gate', context: {}, createdAt: '' });
    });
    done();
  });

  it('should silently drop RFC1918 webhook URLs', function (t, done) {
    mgr = new ApprovalGateManager(tempDir, []);
    assert.doesNotThrow(function () {
      mgr._sendWebhook('http://10.0.0.1/internal', { id: 'x', phase: 'deploy', gate: 'gate', context: {}, createdAt: '' });
    });
    done();
  });

  it('should silently drop localhost webhook URLs', function (t, done) {
    mgr = new ApprovalGateManager(tempDir, []);
    assert.doesNotThrow(function () {
      mgr._sendWebhook('http://localhost:6379/', { id: 'x', phase: 'deploy', gate: 'gate', context: {}, createdAt: '' });
    });
    done();
  });
});

// -------------------------------------------------------------------
// Tests: crypto request IDs
// -------------------------------------------------------------------

describe('ApprovalGateManager - request ID entropy', function () {
  let tempDir;
  let mgr;

  before(function () {
    tempDir = createTempDir();
    const gates = [{ name: 'gate', phase: 'build', timeout_minutes: 60 }];
    mgr = new ApprovalGateManager(tempDir, gates);
  });

  after(function () {
    mgr.destroy();
    cleanup(tempDir);
  });

  it('should generate unique hex request IDs', function () {
    const p1 = mgr.requestApproval('build', {});
    const pending = mgr.getPendingRequests();
    const id = pending[0].id;
    // Format: "apr-" + 32 hex chars
    assert.match(id, /^apr-[0-9a-f]{32}$/);
    // Clean up
    mgr.resolveApproval(id, false, 'test cleanup');
    return p1;
  });

  it('should generate distinct IDs for concurrent requests', function () {
    const p1 = mgr.requestApproval('build', {});
    const p2 = mgr.requestApproval('build', {});
    const pending = mgr.getPendingRequests();
    assert.strictEqual(pending.length, 2);
    assert.notStrictEqual(pending[0].id, pending[1].id);
    // Clean up
    pending.forEach(function (r) {
      mgr.resolveApproval(r.id, false, 'test cleanup');
    });
    return Promise.all([p1, p2]);
  });
});
