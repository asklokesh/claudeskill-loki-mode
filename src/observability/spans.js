'use strict';

/**
 * Span creation helpers for Loki Mode instrumentation.
 *
 * Provides typed span constructors for the RARV cycle, quality gates,
 * agent lifecycle, and completion council.
 *
 * All span functions accept an optional parentSpan to build trace hierarchies.
 * When a parentSpan is provided, the child span inherits the traceId and
 * references the parent's spanId.
 */

const otel = require('./otel');

// -------------------------------------------------------------------
// Helper: create a child span from a parent
// -------------------------------------------------------------------

function _createSpan(name, parentSpan, attributes) {
  const tracer = otel.tracerProvider.getTracer('loki-mode');
  const options = { attributes: attributes || {} };

  if (parentSpan) {
    options.traceId = parentSpan.traceId;
    options.parentSpanId = parentSpan.spanId;
  }

  return tracer.startSpan(name, options);
}

// -------------------------------------------------------------------
// Project span - root span for an entire project execution
// -------------------------------------------------------------------

/**
 * Start a root span for a project.
 * @param {string} projectId - The project identifier
 * @returns {Span} The root project span
 */
function startProjectSpan(projectId) {
  const span = _createSpan('project', null, {
    'loki.project.id': projectId,
    'loki.span.type': 'project',
  });
  return span;
}

// -------------------------------------------------------------------
// Task span - child of a project span
// -------------------------------------------------------------------

/**
 * Start a span for an individual task within a project.
 * @param {Span} parentSpan - The parent project span
 * @param {string} taskId - The task identifier
 * @returns {Span} The task span
 */
function startTaskSpan(parentSpan, taskId) {
  const span = _createSpan('task', parentSpan, {
    'loki.task.id': taskId,
    'loki.span.type': 'task',
  });
  return span;
}

// -------------------------------------------------------------------
// RARV cycle span - child of a task span
// -------------------------------------------------------------------

const VALID_RARV_PHASES = ['REASON', 'ACT', 'REFLECT', 'VERIFY'];

/**
 * Start a span for a RARV cycle phase.
 * @param {Span} parentSpan - The parent task span
 * @param {string} phase - One of: REASON, ACT, REFLECT, VERIFY
 * @returns {Span} The RARV phase span
 */
function startRARVSpan(parentSpan, phase) {
  const normalizedPhase = (phase || '').toUpperCase();
  if (!VALID_RARV_PHASES.includes(normalizedPhase)) {
    throw new Error(
      `Invalid RARV phase: "${phase}". Must be one of: ${VALID_RARV_PHASES.join(', ')}`
    );
  }

  const span = _createSpan(`rarv.${normalizedPhase.toLowerCase()}`, parentSpan, {
    'loki.rarv.phase': normalizedPhase,
    'loki.span.type': 'rarv',
  });
  return span;
}

// -------------------------------------------------------------------
// Quality gate span - child of a task or RARV span
// -------------------------------------------------------------------

/**
 * Start a span for a quality gate check.
 * @param {Span} parentSpan - The parent span
 * @param {string} gateName - Name of the quality gate
 * @param {string} result - 'pass' or 'fail'
 * @returns {Span} The quality gate span
 */
function startQualityGateSpan(parentSpan, gateName, result) {
  const normalizedResult = (result || '').toLowerCase();
  const passed = normalizedResult === 'pass';

  const span = _createSpan(`quality_gate.${gateName}`, parentSpan, {
    'loki.quality_gate.name': gateName,
    'loki.quality_gate.result': normalizedResult,
    'loki.quality_gate.passed': passed,
    'loki.span.type': 'quality_gate',
  });

  if (!passed) {
    span.setStatus(otel.SpanStatusCode.ERROR, `Quality gate "${gateName}" failed`);
  } else {
    span.setStatus(otel.SpanStatusCode.OK);
  }

  return span;
}

// -------------------------------------------------------------------
// Agent lifecycle span - child of a task span
// -------------------------------------------------------------------

const VALID_AGENT_ACTIONS = ['spawn', 'work', 'complete', 'fail'];

/**
 * Start a span for an agent lifecycle event.
 * @param {Span} parentSpan - The parent span
 * @param {string} agentType - Type of agent (e.g., 'code-review', 'test-writer')
 * @param {string} action - One of: spawn, work, complete, fail
 * @returns {Span} The agent span
 */
function startAgentSpan(parentSpan, agentType, action) {
  const normalizedAction = (action || '').toLowerCase();
  if (!VALID_AGENT_ACTIONS.includes(normalizedAction)) {
    throw new Error(
      `Invalid agent action: "${action}". Must be one of: ${VALID_AGENT_ACTIONS.join(', ')}`
    );
  }

  const span = _createSpan(`agent.${agentType}.${normalizedAction}`, parentSpan, {
    'loki.agent.type': agentType,
    'loki.agent.action': normalizedAction,
    'loki.span.type': 'agent',
  });

  if (normalizedAction === 'fail') {
    span.setStatus(otel.SpanStatusCode.ERROR, `Agent "${agentType}" failed`);
  }

  return span;
}

// -------------------------------------------------------------------
// Council review span - child of a task span
// -------------------------------------------------------------------

/**
 * Start a span for a completion council review.
 * @param {Span} parentSpan - The parent span
 * @param {string} reviewerType - Type of reviewer (e.g., 'security', 'performance')
 * @param {string} verdict - The review verdict (e.g., 'approve', 'reject', 'request-changes')
 * @returns {Span} The council span
 */
function startCouncilSpan(parentSpan, reviewerType, verdict) {
  const normalizedVerdict = (verdict || '').toLowerCase();
  const approved = normalizedVerdict === 'approve';

  const span = _createSpan(`council.${reviewerType}`, parentSpan, {
    'loki.council.reviewer': reviewerType,
    'loki.council.verdict': normalizedVerdict,
    'loki.council.approved': approved,
    'loki.span.type': 'council',
  });

  if (normalizedVerdict === 'reject') {
    span.setStatus(otel.SpanStatusCode.ERROR, `Council reviewer "${reviewerType}" rejected`);
  } else if (approved) {
    span.setStatus(otel.SpanStatusCode.OK);
  }

  return span;
}

module.exports = {
  startProjectSpan,
  startTaskSpan,
  startRARVSpan,
  startQualityGateSpan,
  startAgentSpan,
  startCouncilSpan,
  VALID_RARV_PHASES,
  VALID_AGENT_ACTIONS,
};
