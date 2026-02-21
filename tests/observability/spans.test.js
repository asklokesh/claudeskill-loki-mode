'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('spans.js - Span creation helpers', () => {
  let spans;
  let otel;
  const ORIGINAL_ENV = process.env.LOKI_OTEL_ENDPOINT;

  before(() => {
    process.env.LOKI_OTEL_ENDPOINT = 'http://localhost:4318';
  });

  beforeEach(() => {
    // Clear caches for clean state
    delete require.cache[require.resolve('../../src/observability/otel')];
    delete require.cache[require.resolve('../../src/observability/spans')];

    process.env.LOKI_OTEL_ENDPOINT = 'http://localhost:4318';
    otel = require('../../src/observability/otel');
    otel.initialize();
    spans = require('../../src/observability/spans');
  });

  afterEach(() => {
    otel.shutdown();
    if (ORIGINAL_ENV) {
      process.env.LOKI_OTEL_ENDPOINT = ORIGINAL_ENV;
    } else {
      delete process.env.LOKI_OTEL_ENDPOINT;
    }
  });

  describe('startProjectSpan', () => {
    it('should create a root span for a project', () => {
      const span = spans.startProjectSpan('proj-123');

      assert.equal(span.name, 'project');
      assert.equal(span.attributes['loki.project.id'], 'proj-123');
      assert.equal(span.attributes['loki.span.type'], 'project');
      assert.equal(span.parentSpanId, '');
      assert.ok(span.traceId);
      assert.ok(span.spanId);

      span.end();
    });
  });

  describe('startTaskSpan', () => {
    it('should create a child span under a project', () => {
      const projectSpan = spans.startProjectSpan('proj-1');
      const taskSpan = spans.startTaskSpan(projectSpan, 'task-42');

      assert.equal(taskSpan.name, 'task');
      assert.equal(taskSpan.attributes['loki.task.id'], 'task-42');
      assert.equal(taskSpan.attributes['loki.span.type'], 'task');
      // Verify parent-child relationship
      assert.equal(taskSpan.traceId, projectSpan.traceId, 'should share traceId with parent');
      assert.equal(taskSpan.parentSpanId, projectSpan.spanId, 'parentSpanId should match parent spanId');

      taskSpan.end();
      projectSpan.end();
    });
  });

  describe('startRARVSpan', () => {
    it('should create spans for all four RARV phases', () => {
      const taskSpan = spans.startProjectSpan('proj-1');

      for (const phase of ['REASON', 'ACT', 'REFLECT', 'VERIFY']) {
        const rarvSpan = spans.startRARVSpan(taskSpan, phase);
        assert.equal(rarvSpan.name, `rarv.${phase.toLowerCase()}`);
        assert.equal(rarvSpan.attributes['loki.rarv.phase'], phase);
        assert.equal(rarvSpan.attributes['loki.span.type'], 'rarv');
        assert.equal(rarvSpan.traceId, taskSpan.traceId);
        assert.equal(rarvSpan.parentSpanId, taskSpan.spanId);
        rarvSpan.end();
      }

      taskSpan.end();
    });

    it('should accept lowercase phase names', () => {
      const parent = spans.startProjectSpan('proj-1');
      const span = spans.startRARVSpan(parent, 'reason');
      assert.equal(span.attributes['loki.rarv.phase'], 'REASON');
      span.end();
      parent.end();
    });

    it('should reject invalid phase names', () => {
      const parent = spans.startProjectSpan('proj-1');
      assert.throws(
        () => spans.startRARVSpan(parent, 'INVALID'),
        /Invalid RARV phase/
      );
      parent.end();
    });
  });

  describe('startQualityGateSpan', () => {
    it('should create a passing quality gate span', () => {
      const parent = spans.startProjectSpan('proj-1');
      const span = spans.startQualityGateSpan(parent, 'static-analysis', 'pass');

      assert.equal(span.name, 'quality_gate.static-analysis');
      assert.equal(span.attributes['loki.quality_gate.name'], 'static-analysis');
      assert.equal(span.attributes['loki.quality_gate.result'], 'pass');
      assert.equal(span.attributes['loki.quality_gate.passed'], true);
      assert.equal(span.status.code, otel.SpanStatusCode.OK);

      span.end();
      parent.end();
    });

    it('should create a failing quality gate span with ERROR status', () => {
      const parent = spans.startProjectSpan('proj-1');
      const span = spans.startQualityGateSpan(parent, 'test-coverage', 'fail');

      assert.equal(span.attributes['loki.quality_gate.passed'], false);
      assert.equal(span.status.code, otel.SpanStatusCode.ERROR);
      assert.ok(span.status.message.includes('test-coverage'));

      span.end();
      parent.end();
    });
  });

  describe('startAgentSpan', () => {
    it('should create spans for all valid agent actions', () => {
      const parent = spans.startProjectSpan('proj-1');

      for (const action of ['spawn', 'work', 'complete', 'fail']) {
        const span = spans.startAgentSpan(parent, 'code-review', action);
        assert.equal(span.name, `agent.code-review.${action}`);
        assert.equal(span.attributes['loki.agent.type'], 'code-review');
        assert.equal(span.attributes['loki.agent.action'], action);
        assert.equal(span.attributes['loki.span.type'], 'agent');
        span.end();
      }

      parent.end();
    });

    it('should set ERROR status for fail action', () => {
      const parent = spans.startProjectSpan('proj-1');
      const span = spans.startAgentSpan(parent, 'test-writer', 'fail');

      assert.equal(span.status.code, otel.SpanStatusCode.ERROR);
      span.end();
      parent.end();
    });

    it('should reject invalid agent actions', () => {
      const parent = spans.startProjectSpan('proj-1');
      assert.throws(
        () => spans.startAgentSpan(parent, 'test', 'INVALID'),
        /Invalid agent action/
      );
      parent.end();
    });
  });

  describe('startCouncilSpan', () => {
    it('should create an approval span', () => {
      const parent = spans.startProjectSpan('proj-1');
      const span = spans.startCouncilSpan(parent, 'security', 'approve');

      assert.equal(span.name, 'council.security');
      assert.equal(span.attributes['loki.council.reviewer'], 'security');
      assert.equal(span.attributes['loki.council.verdict'], 'approve');
      assert.equal(span.attributes['loki.council.approved'], true);
      assert.equal(span.status.code, otel.SpanStatusCode.OK);

      span.end();
      parent.end();
    });

    it('should create a rejection span with ERROR status', () => {
      const parent = spans.startProjectSpan('proj-1');
      const span = spans.startCouncilSpan(parent, 'performance', 'reject');

      assert.equal(span.attributes['loki.council.approved'], false);
      assert.equal(span.status.code, otel.SpanStatusCode.ERROR);

      span.end();
      parent.end();
    });

    it('should handle request-changes verdict', () => {
      const parent = spans.startProjectSpan('proj-1');
      const span = spans.startCouncilSpan(parent, 'architecture', 'request-changes');

      assert.equal(span.attributes['loki.council.verdict'], 'request-changes');
      assert.equal(span.attributes['loki.council.approved'], false);
      // Not rejected, not approved - status should be UNSET
      assert.equal(span.status.code, otel.SpanStatusCode.UNSET);

      span.end();
      parent.end();
    });
  });

  describe('span hierarchy (full trace)', () => {
    it('should maintain correct parent-child relationships across a full RARV cycle', () => {
      const projectSpan = spans.startProjectSpan('proj-full');
      const taskSpan = spans.startTaskSpan(projectSpan, 'task-1');
      const reasonSpan = spans.startRARVSpan(taskSpan, 'REASON');
      const actSpan = spans.startRARVSpan(taskSpan, 'ACT');
      const agentSpan = spans.startAgentSpan(actSpan, 'code-writer', 'spawn');
      const reflectSpan = spans.startRARVSpan(taskSpan, 'REFLECT');
      const qgSpan = spans.startQualityGateSpan(reflectSpan, 'lint', 'pass');
      const verifySpan = spans.startRARVSpan(taskSpan, 'VERIFY');
      const councilSpan = spans.startCouncilSpan(verifySpan, 'final-review', 'approve');

      // All spans share the same traceId
      const traceId = projectSpan.traceId;
      assert.equal(taskSpan.traceId, traceId);
      assert.equal(reasonSpan.traceId, traceId);
      assert.equal(actSpan.traceId, traceId);
      assert.equal(agentSpan.traceId, traceId);
      assert.equal(reflectSpan.traceId, traceId);
      assert.equal(qgSpan.traceId, traceId);
      assert.equal(verifySpan.traceId, traceId);
      assert.equal(councilSpan.traceId, traceId);

      // Parent chain
      assert.equal(taskSpan.parentSpanId, projectSpan.spanId);
      assert.equal(reasonSpan.parentSpanId, taskSpan.spanId);
      assert.equal(actSpan.parentSpanId, taskSpan.spanId);
      assert.equal(agentSpan.parentSpanId, actSpan.spanId);
      assert.equal(reflectSpan.parentSpanId, taskSpan.spanId);
      assert.equal(qgSpan.parentSpanId, reflectSpan.spanId);
      assert.equal(verifySpan.parentSpanId, taskSpan.spanId);
      assert.equal(councilSpan.parentSpanId, verifySpan.spanId);

      // All span IDs are unique
      const spanIds = [
        projectSpan, taskSpan, reasonSpan, actSpan,
        agentSpan, reflectSpan, qgSpan, verifySpan, councilSpan,
      ].map((s) => s.spanId);
      const uniqueIds = new Set(spanIds);
      assert.equal(uniqueIds.size, spanIds.length, 'all span IDs should be unique');

      // End all spans
      councilSpan.end();
      verifySpan.end();
      qgSpan.end();
      reflectSpan.end();
      agentSpan.end();
      actSpan.end();
      reasonSpan.end();
      taskSpan.end();
      projectSpan.end();
    });
  });
});
