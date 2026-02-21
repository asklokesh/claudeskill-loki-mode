'use strict';

/**
 * Metric definitions for Loki Mode observability.
 *
 * Defines all standard metrics:
 * - loki_task_duration_seconds (histogram)
 * - loki_quality_gate_pass_total (counter)
 * - loki_quality_gate_fail_total (counter)
 * - loki_agent_active (gauge)
 * - loki_tokens_consumed_total (counter, by model and agent type)
 * - loki_council_approval_rate (gauge)
 *
 * Compatible with Prometheus naming conventions.
 */

const otel = require('./otel');

let _metrics = null;

/**
 * Initialize all metrics. Must be called after otel.initialize().
 * @returns {Object} An object containing all metric instruments.
 */
function initMetrics() {
  if (_metrics) return _metrics;

  const meter = otel.meterProvider.getMeter('loki-mode');

  _metrics = {
    taskDuration: meter.createHistogram(
      'loki_task_duration_seconds',
      'Duration of task execution in seconds',
      's',
      [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600]
    ),

    qualityGatePass: meter.createCounter(
      'loki_quality_gate_pass_total',
      'Total number of quality gate passes',
      '{passes}'
    ),

    qualityGateFail: meter.createCounter(
      'loki_quality_gate_fail_total',
      'Total number of quality gate failures',
      '{failures}'
    ),

    agentActive: meter.createGauge(
      'loki_agent_active',
      'Number of currently active agents',
      '{agents}'
    ),

    tokensConsumed: meter.createCounter(
      'loki_tokens_consumed_total',
      'Total tokens consumed by model and agent type',
      '{tokens}'
    ),

    councilApprovalRate: meter.createGauge(
      'loki_council_approval_rate',
      'Current council approval rate (0.0 to 1.0)',
      '1'
    ),
  };

  return _metrics;
}

/**
 * Get the current metrics instance. Returns null if not initialized.
 */
function getMetrics() {
  return _metrics;
}

/**
 * Record a task duration.
 * @param {number} durationSeconds - Duration in seconds
 * @param {Object} [labels] - Optional labels (e.g., { taskType: 'build' })
 */
function recordTaskDuration(durationSeconds, labels) {
  if (!_metrics) return;
  _metrics.taskDuration.record(durationSeconds, labels);
}

/**
 * Record a quality gate result.
 * @param {string} gateName - Name of the quality gate
 * @param {boolean} passed - Whether the gate passed
 */
function recordQualityGateResult(gateName, passed) {
  if (!_metrics) return;
  const labels = { gate: gateName };
  if (passed) {
    _metrics.qualityGatePass.add(1, labels);
  } else {
    _metrics.qualityGateFail.add(1, labels);
  }
}

/**
 * Set the active agent count.
 * @param {number} count - Number of active agents
 * @param {Object} [labels] - Optional labels (e.g., { agentType: 'code-review' })
 */
function setActiveAgents(count, labels) {
  if (!_metrics) return;
  _metrics.agentActive.set(count, labels);
}

/**
 * Record tokens consumed.
 * @param {number} tokens - Number of tokens consumed
 * @param {string} model - Model name (e.g., 'opus', 'sonnet', 'haiku')
 * @param {string} agentType - Agent type (e.g., 'code-review', 'test-writer')
 */
function recordTokensConsumed(tokens, model, agentType) {
  if (!_metrics) return;
  _metrics.tokensConsumed.add(tokens, { model, agentType });
}

/**
 * Set the council approval rate.
 * @param {number} rate - Approval rate (0.0 to 1.0)
 */
function setCouncilApprovalRate(rate) {
  if (!_metrics) return;
  _metrics.councilApprovalRate.set(rate);
}

/**
 * Flush all metrics to the OTLP endpoint.
 */
function flushMetrics() {
  if (!_metrics) return;

  const exporter = otel.getExporter();
  if (!exporter) return;

  const metricsList = [
    _metrics.taskDuration,
    _metrics.qualityGatePass,
    _metrics.qualityGateFail,
    _metrics.agentActive,
    _metrics.tokensConsumed,
    _metrics.councilApprovalRate,
  ];

  return exporter.flushMetrics(metricsList);
}

/**
 * Reset metrics instance (for testing).
 */
function resetMetrics() {
  _metrics = null;
}

module.exports = {
  initMetrics,
  getMetrics,
  recordTaskDuration,
  recordQualityGateResult,
  setActiveAgents,
  recordTokensConsumed,
  setCouncilApprovalRate,
  flushMetrics,
  resetMetrics,
};
