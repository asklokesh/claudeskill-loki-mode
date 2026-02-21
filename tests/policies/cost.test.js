'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CostController } = require('../../src/policies/cost');

// -------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-cost-test-'));
  fs.mkdirSync(path.join(dir, '.loki', 'state'), { recursive: true });
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// -------------------------------------------------------------------
// Tests: CostController - no budget
// -------------------------------------------------------------------

describe('CostController - no budget configured', function () {
  let tempDir;
  let controller;

  before(function () {
    tempDir = createTempDir();
    controller = new CostController(tempDir, []);
  });

  after(function () {
    controller.removeAllListeners();
    cleanup(tempDir);
  });

  it('should return unlimited budget when no resource policies', function () {
    const budget = controller.checkBudget();
    assert.strictEqual(budget.remaining, Infinity);
    assert.strictEqual(budget.percentage, 0);
    assert.strictEqual(budget.alerts.length, 0);
    assert.strictEqual(budget.exceeded, false);
  });

  it('should accept usage recording without errors', function () {
    controller.recordUsage('proj-1', { agentId: 'agent-1', model: 'opus', tokens: 1000 });
    // No crash = pass
  });
});

// -------------------------------------------------------------------
// Tests: CostController - with budget
// -------------------------------------------------------------------

describe('CostController - with budget', function () {
  let tempDir;
  let controller;
  const resourcePolicies = [
    {
      name: 'token-budget',
      max_tokens: 10000,
      alerts: [50, 80, 100],
      on_exceed: 'shutdown',
    },
  ];

  beforeEach(function () {
    tempDir = createTempDir();
    controller = new CostController(tempDir, resourcePolicies);
  });

  afterEach(function () {
    controller.removeAllListeners();
    cleanup(tempDir);
  });

  it('should track token usage per project', function () {
    controller.recordUsage('proj-1', { agentId: 'a1', model: 'opus', tokens: 2000 });
    controller.recordUsage('proj-1', { agentId: 'a2', model: 'sonnet', tokens: 1000 });

    const report = controller.getProjectReport('proj-1');
    assert.ok(report);
    assert.strictEqual(report.totalTokens, 3000);
    assert.strictEqual(report.entries.length, 2);
  });

  it('should track per-agent totals', function () {
    controller.recordUsage('proj-1', { agentId: 'agent-1', model: 'opus', tokens: 500 });
    controller.recordUsage('proj-1', { agentId: 'agent-1', model: 'opus', tokens: 700 });
    controller.recordUsage('proj-1', { agentId: 'agent-2', model: 'sonnet', tokens: 300 });

    const agents = controller.getAgentReport();
    assert.strictEqual(agents['agent-1'].totalTokens, 1200);
    assert.strictEqual(agents['agent-2'].totalTokens, 300);
  });

  it('should check budget percentage correctly', function () {
    controller.recordUsage('proj-1', { tokens: 5000 });
    const budget = controller.checkBudget('proj-1');
    assert.strictEqual(budget.percentage, 50);
    assert.strictEqual(budget.remaining, 5000);
    assert.strictEqual(budget.exceeded, false);
  });

  it('should report alerts at 50% threshold', function () {
    controller.recordUsage('proj-1', { tokens: 5000 });
    const budget = controller.checkBudget('proj-1');
    assert.ok(budget.alerts.length >= 1);
    assert.ok(budget.alerts.some(function (a) { return a.threshold === 50; }));
  });

  it('should report alerts at 80% threshold', function () {
    controller.recordUsage('proj-1', { tokens: 8000 });
    const budget = controller.checkBudget('proj-1');
    assert.ok(budget.alerts.some(function (a) { return a.threshold === 80; }));
  });

  it('should report exceeded at 100%', function () {
    controller.recordUsage('proj-1', { tokens: 10000 });
    const budget = controller.checkBudget('proj-1');
    assert.strictEqual(budget.exceeded, true);
    assert.strictEqual(budget.remaining, 0);
  });

  it('should emit alert events at thresholds', function () {
    const alerts = [];
    controller.on('alert', function (data) {
      alerts.push(data);
    });

    controller.recordUsage('proj-1', { tokens: 5000 }); // 50%
    assert.ok(alerts.length >= 1);
    assert.strictEqual(alerts[0].threshold, 50);
  });

  it('should emit shutdown event when budget exceeded', function () {
    let shutdownEvent = null;
    controller.on('shutdown', function (data) {
      shutdownEvent = data;
    });

    controller.recordUsage('proj-1', { tokens: 10000 });
    assert.ok(shutdownEvent);
    assert.strictEqual(shutdownEvent.reason, 'Token budget exceeded');
  });

  it('should only emit shutdown once', function () {
    let shutdownCount = 0;
    controller.on('shutdown', function () {
      shutdownCount++;
    });

    controller.recordUsage('proj-1', { tokens: 10000 });
    controller.recordUsage('proj-1', { tokens: 5000 }); // Over budget again
    assert.strictEqual(shutdownCount, 1);
  });

  it('should not emit duplicate alerts for same threshold', function () {
    const alerts = [];
    controller.on('alert', function (data) {
      alerts.push(data);
    });

    controller.recordUsage('proj-1', { tokens: 5500 }); // 55%
    controller.recordUsage('proj-1', { tokens: 500 });   // 60%

    // Only one alert for 50% threshold
    const fiftyAlerts = alerts.filter(function (a) { return a.threshold === 50; });
    assert.strictEqual(fiftyAlerts.length, 1);
  });

  it('should persist cost data to file', function () {
    controller.recordUsage('proj-1', { agentId: 'a1', model: 'opus', tokens: 1000 });

    const stateFile = path.join(tempDir, '.loki', 'state', 'costs.json');
    assert.ok(fs.existsSync(stateFile));

    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.strictEqual(saved.totalTokens, 1000);
    assert.ok(saved.projects['proj-1']);
  });

  it('should reset tracking data', function () {
    controller.recordUsage('proj-1', { tokens: 5000 });
    controller.reset();

    const budget = controller.checkBudget('proj-1');
    assert.strictEqual(budget.percentage, 0);
    assert.strictEqual(budget.exceeded, false);

    const agents = controller.getAgentReport();
    assert.deepStrictEqual(agents, {});
  });

  it('should return history of events', function () {
    controller.recordUsage('proj-1', { tokens: 10000 }); // triggers 50%, 80%, 100% alerts + shutdown

    const history = controller.getHistory();
    assert.ok(history.length > 0);
    assert.ok(history.some(function (h) { return h.type === 'alert'; }));
    assert.ok(history.some(function (h) { return h.type === 'shutdown'; }));
  });
});

// -------------------------------------------------------------------
// Tests: CostController - state persistence across instances
// -------------------------------------------------------------------

describe('CostController - persistence', function () {
  let tempDir;
  const resourcePolicies = [
    { name: 'budget', max_tokens: 100000, alerts: [50, 80, 100], on_exceed: 'shutdown' },
  ];

  before(function () {
    tempDir = createTempDir();
  });

  after(function () {
    cleanup(tempDir);
  });

  it('should load previous state on new instance', function () {
    const c1 = new CostController(tempDir, resourcePolicies);
    c1.recordUsage('proj-1', { agentId: 'a1', tokens: 5000 });
    c1.removeAllListeners();

    // Create new instance from same directory
    const c2 = new CostController(tempDir, resourcePolicies);
    const budget = c2.checkBudget('proj-1');
    assert.strictEqual(budget.percentage, 5); // 5000 / 100000 = 5%
    c2.removeAllListeners();
  });
});

// -------------------------------------------------------------------
// Tests: CostController - per-project shutdown flag (Finding 7 fix)
// -------------------------------------------------------------------

describe('CostController - per-project shutdown isolation', function () {
  let tempDir;
  let controller;
  const resourcePolicies = [
    { name: 'budget', max_tokens: 1000, alerts: [100], on_exceed: 'shutdown' },
  ];

  before(function () {
    tempDir = createTempDir();
  });

  beforeEach(function () {
    controller = new CostController(tempDir, resourcePolicies);
  });

  afterEach(function () {
    controller.removeAllListeners();
    controller.reset();
  });

  after(function () {
    cleanup(tempDir);
  });

  it('should emit shutdown for project-a and still emit for project-b independently', function () {
    const shutdowns = [];
    controller.on('shutdown', function (data) { shutdowns.push(data.projectId); });

    // Exceed budget for project-a
    controller.recordUsage('proj-a', { tokens: 1001 });
    assert.strictEqual(shutdowns.length, 1);
    assert.strictEqual(shutdowns[0], 'proj-a');

    // proj-a shutdown should not block proj-b
    controller.recordUsage('proj-b', { tokens: 1001 });
    assert.strictEqual(shutdowns.length, 2);
    assert.strictEqual(shutdowns[1], 'proj-b');
  });

  it('should not emit duplicate shutdown for same project', function () {
    const shutdowns = [];
    controller.on('shutdown', function (data) { shutdowns.push(data.projectId); });

    controller.recordUsage('proj-a', { tokens: 1001 });
    controller.recordUsage('proj-a', { tokens: 1001 }); // second call should not re-emit
    assert.strictEqual(shutdowns.length, 1, 'Shutdown must only be emitted once per project');
  });
});
