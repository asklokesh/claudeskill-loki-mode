'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('metrics.js - Metric definitions', () => {
  let metricsModule;
  let otel;
  const ORIGINAL_ENV = process.env.LOKI_OTEL_ENDPOINT;

  beforeEach(() => {
    // Clear caches
    delete require.cache[require.resolve('../../src/observability/otel')];
    delete require.cache[require.resolve('../../src/observability/metrics')];

    process.env.LOKI_OTEL_ENDPOINT = 'http://localhost:4318';
    otel = require('../../src/observability/otel');
    otel.initialize();
    metricsModule = require('../../src/observability/metrics');
    metricsModule.resetMetrics();
  });

  afterEach(() => {
    metricsModule.resetMetrics();
    otel.shutdown();
    if (ORIGINAL_ENV) {
      process.env.LOKI_OTEL_ENDPOINT = ORIGINAL_ENV;
    } else {
      delete process.env.LOKI_OTEL_ENDPOINT;
    }
  });

  describe('initMetrics', () => {
    it('should initialize all five metric instruments', () => {
      const m = metricsModule.initMetrics();
      assert.ok(m.taskDuration, 'taskDuration histogram');
      assert.ok(m.qualityGatePass, 'qualityGatePass counter');
      assert.ok(m.qualityGateFail, 'qualityGateFail counter');
      assert.ok(m.agentActive, 'agentActive gauge');
      assert.ok(m.tokensConsumed, 'tokensConsumed counter');
      assert.ok(m.councilApprovalRate, 'councilApprovalRate gauge');
    });

    it('should return the same instance on multiple calls', () => {
      const m1 = metricsModule.initMetrics();
      const m2 = metricsModule.initMetrics();
      assert.equal(m1, m2);
    });
  });

  describe('loki_task_duration_seconds (histogram)', () => {
    it('should record task durations', () => {
      metricsModule.initMetrics();
      metricsModule.recordTaskDuration(1.5);
      metricsModule.recordTaskDuration(5.2);
      metricsModule.recordTaskDuration(0.3);

      const m = metricsModule.getMetrics();
      const values = m.taskDuration.get();
      assert.equal(values.length, 3);
      assert.deepEqual(values, [1.5, 5.2, 0.3]);
    });

    it('should record durations with labels', () => {
      metricsModule.initMetrics();
      metricsModule.recordTaskDuration(2.0, { taskType: 'build' });
      metricsModule.recordTaskDuration(0.5, { taskType: 'lint' });

      const m = metricsModule.getMetrics();
      assert.equal(m.taskDuration.get({ taskType: 'build' }).length, 1);
      assert.equal(m.taskDuration.get({ taskType: 'lint' }).length, 1);
    });

    it('should have correct OTLP name', () => {
      metricsModule.initMetrics();
      metricsModule.recordTaskDuration(1.0);
      const m = metricsModule.getMetrics();
      const otlp = m.taskDuration.toOTLP();
      assert.equal(otlp.name, 'loki_task_duration_seconds');
      assert.equal(otlp.unit, 's');
    });
  });

  describe('loki_quality_gate_pass_total / fail_total (counters)', () => {
    it('should record pass results', () => {
      metricsModule.initMetrics();
      metricsModule.recordQualityGateResult('static-analysis', true);
      metricsModule.recordQualityGateResult('static-analysis', true);
      metricsModule.recordQualityGateResult('test-coverage', true);

      const m = metricsModule.getMetrics();
      assert.equal(m.qualityGatePass.get({ gate: 'static-analysis' }), 2);
      assert.equal(m.qualityGatePass.get({ gate: 'test-coverage' }), 1);
    });

    it('should record fail results', () => {
      metricsModule.initMetrics();
      metricsModule.recordQualityGateResult('lint', false);
      metricsModule.recordQualityGateResult('lint', false);

      const m = metricsModule.getMetrics();
      assert.equal(m.qualityGateFail.get({ gate: 'lint' }), 2);
      assert.equal(m.qualityGatePass.get({ gate: 'lint' }), 0);
    });

    it('should have correct OTLP names', () => {
      metricsModule.initMetrics();
      const m = metricsModule.getMetrics();
      assert.equal(m.qualityGatePass.toOTLP().name, 'loki_quality_gate_pass_total');
      assert.equal(m.qualityGateFail.toOTLP().name, 'loki_quality_gate_fail_total');
    });
  });

  describe('loki_agent_active (gauge)', () => {
    it('should set and update active agent count', () => {
      metricsModule.initMetrics();
      metricsModule.setActiveAgents(5);

      const m = metricsModule.getMetrics();
      assert.equal(m.agentActive.get(), 5);

      metricsModule.setActiveAgents(3);
      assert.equal(m.agentActive.get(), 3);
    });

    it('should support labeled values by agent type', () => {
      metricsModule.initMetrics();
      metricsModule.setActiveAgents(2, { agentType: 'code-review' });
      metricsModule.setActiveAgents(1, { agentType: 'test-writer' });

      const m = metricsModule.getMetrics();
      assert.equal(m.agentActive.get({ agentType: 'code-review' }), 2);
      assert.equal(m.agentActive.get({ agentType: 'test-writer' }), 1);
    });

    it('should have correct OTLP name', () => {
      metricsModule.initMetrics();
      const m = metricsModule.getMetrics();
      assert.equal(m.agentActive.toOTLP().name, 'loki_agent_active');
    });
  });

  describe('loki_tokens_consumed_total (counter by model and agent type)', () => {
    it('should record tokens by model and agent type', () => {
      metricsModule.initMetrics();
      metricsModule.recordTokensConsumed(1500, 'opus', 'code-review');
      metricsModule.recordTokensConsumed(500, 'opus', 'code-review');
      metricsModule.recordTokensConsumed(200, 'sonnet', 'test-writer');

      const m = metricsModule.getMetrics();
      assert.equal(m.tokensConsumed.get({ model: 'opus', agentType: 'code-review' }), 2000);
      assert.equal(m.tokensConsumed.get({ model: 'sonnet', agentType: 'test-writer' }), 200);
    });

    it('should have correct OTLP name', () => {
      metricsModule.initMetrics();
      const m = metricsModule.getMetrics();
      assert.equal(m.tokensConsumed.toOTLP().name, 'loki_tokens_consumed_total');
    });
  });

  describe('loki_council_approval_rate (gauge)', () => {
    it('should set approval rate', () => {
      metricsModule.initMetrics();
      metricsModule.setCouncilApprovalRate(0.85);

      const m = metricsModule.getMetrics();
      assert.equal(m.councilApprovalRate.get(), 0.85);
    });

    it('should update when rate changes', () => {
      metricsModule.initMetrics();
      metricsModule.setCouncilApprovalRate(0.85);
      metricsModule.setCouncilApprovalRate(0.92);

      const m = metricsModule.getMetrics();
      assert.equal(m.councilApprovalRate.get(), 0.92);
    });

    it('should have correct OTLP name', () => {
      metricsModule.initMetrics();
      const m = metricsModule.getMetrics();
      assert.equal(m.councilApprovalRate.toOTLP().name, 'loki_council_approval_rate');
    });
  });

  describe('flushMetrics', () => {
    it('should not throw when metrics are not initialized', () => {
      metricsModule.resetMetrics();
      // Should not throw
      metricsModule.flushMetrics();
    });

    it('should flush all metrics to the exporter', () => {
      metricsModule.initMetrics();
      metricsModule.recordTaskDuration(1.0);
      metricsModule.recordQualityGateResult('lint', true);
      metricsModule.setActiveAgents(3);
      metricsModule.recordTokensConsumed(100, 'opus', 'review');
      metricsModule.setCouncilApprovalRate(0.9);

      // Should not throw
      const result = metricsModule.flushMetrics();
      // Result will be undefined since exporter sends fire-and-forget
      // but the function should complete without error
    });
  });

  describe('no-op behavior when metrics not initialized', () => {
    it('should not throw when recording without init', () => {
      metricsModule.resetMetrics();
      // All of these should be no-ops, not throw
      metricsModule.recordTaskDuration(1.0);
      metricsModule.recordQualityGateResult('lint', true);
      metricsModule.setActiveAgents(5);
      metricsModule.recordTokensConsumed(100, 'opus', 'review');
      metricsModule.setCouncilApprovalRate(0.9);
    });
  });
});
