'use strict';

/**
 * Loki Mode Policy Engine - Public API
 *
 * Single entry point for enterprise policy-as-code governance.
 *
 * Usage:
 *   const policy = require('./src/policies');
 *   const result = policy.evaluate('pre_execution', { file_path: '/tmp/x', project_dir: '/home/proj' });
 *   // { allowed: false, decision: 'DENY', reason: '...', requiresApproval: false, violations: [...] }
 *
 *   const budget = policy.checkBudget('my-project');
 *   // { remaining: 500000, percentage: 50, alerts: [...], exceeded: false }
 *
 *   const approval = await policy.requestApproval('deploy', { branch: 'main' });
 *   // { approved: true, reason: '...', method: 'timeout' }
 *
 * When no .loki/policies.yaml or .loki/policies.json exists:
 *   - All evaluate() calls return ALLOW instantly
 *   - checkBudget() returns unlimited
 *   - requestApproval() auto-approves
 *   - Zero overhead: no disk reads, no watchers, no timers
 */

const { PolicyEngine } = require('./engine');
const { ApprovalGateManager } = require('./approval');
const { CostController } = require('./cost');
const { Decision } = require('./types');

// -------------------------------------------------------------------
// Module-level singleton state
// -------------------------------------------------------------------

let _engine = null;
let _approval = null;
let _cost = null;
let _initialized = false;
let _projectDir = null;

// -------------------------------------------------------------------
// Initialization
// -------------------------------------------------------------------

/**
 * Initialize the policy engine for a project directory.
 * Safe to call multiple times -- subsequent calls are no-ops unless
 * projectDir changes.
 *
 * @param {string} [projectDir] - Project root (default: process.cwd())
 * @param {object} [options]
 * @param {boolean} [options.watch=false] - Watch policy file for changes
 */
function init(projectDir, options) {
  const dir = projectDir || process.cwd();
  if (_initialized && _projectDir === dir) return;

  destroy(); // Clean up any previous instance

  _projectDir = dir;
  _engine = new PolicyEngine(dir, options);

  if (_engine.hasPolicies()) {
    _approval = new ApprovalGateManager(dir, _engine.getApprovalGates());
    _cost = new CostController(dir, _engine.getResourcePolicies());
  }

  _initialized = true;
}

/**
 * Lazy initialization: ensures engine is created before any operation.
 */
function _ensureInit() {
  if (!_initialized) {
    init();
  }
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------

/**
 * Evaluate policies for an action.
 *
 * @param {string} enforcementPoint - One of: pre_execution, pre_deployment, resource, data
 * @param {object} context - Contextual data for evaluation
 * @returns {{ allowed: boolean, decision: string, reason: string, requiresApproval: boolean, violations: Array }}
 */
function evaluate(enforcementPoint, context) {
  _ensureInit();
  return _engine.evaluate(enforcementPoint, context);
}

/**
 * Check the budget status for a project.
 *
 * @param {string} [projectId] - Project identifier
 * @returns {{ remaining: number, percentage: number, alerts: Array, exceeded: boolean }}
 */
function checkBudget(projectId) {
  _ensureInit();
  if (!_cost) {
    return { remaining: Infinity, percentage: 0, alerts: [], exceeded: false };
  }
  return _cost.checkBudget(projectId);
}

/**
 * Record token usage for cost tracking.
 *
 * @param {string} projectId - Project identifier
 * @param {object} usage - { agentId, model, tokens, durationMs }
 */
function recordUsage(projectId, usage) {
  _ensureInit();
  if (_cost) {
    _cost.recordUsage(projectId, usage);
  }
}

/**
 * Request approval for a gate phase.
 *
 * @param {string} phase - The phase name (e.g., "deploy")
 * @param {object} [context] - Contextual data about the request
 * @returns {Promise<{approved: boolean, reason: string, method: string}>}
 */
function requestApproval(phase, context) {
  _ensureInit();
  if (!_approval) {
    return Promise.resolve({
      approved: true,
      reason: 'No policies configured',
      method: 'auto',
    });
  }
  return _approval.requestApproval(phase, context);
}

/**
 * Resolve a pending approval request externally.
 *
 * @param {string} requestId - The approval request ID
 * @param {boolean} approved - Whether to approve or reject
 * @param {string} [reason] - Reason for the decision
 * @returns {boolean} - Whether the request was found and resolved
 */
function resolveApproval(requestId, approved, reason) {
  _ensureInit();
  if (!_approval) return false;
  return _approval.resolveApproval(requestId, approved, reason);
}

/**
 * Check if the engine has policies loaded.
 */
function hasPolicies() {
  _ensureInit();
  return _engine.hasPolicies();
}

/**
 * Get the cost controller instance (for event subscription).
 */
function getCostController() {
  _ensureInit();
  return _cost;
}

/**
 * Get the approval manager instance (for audit trail access).
 */
function getApprovalManager() {
  _ensureInit();
  return _approval;
}

/**
 * Destroy all instances and clean up resources.
 */
function destroy() {
  if (_engine) {
    _engine.destroy();
    _engine = null;
  }
  if (_approval) {
    _approval.destroy();
    _approval = null;
  }
  if (_cost) {
    _cost.removeAllListeners();
    _cost = null;
  }
  _initialized = false;
  _projectDir = null;
}

// -------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------

module.exports = {
  init,
  evaluate,
  checkBudget,
  recordUsage,
  requestApproval,
  resolveApproval,
  hasPolicies,
  getCostController,
  getApprovalManager,
  destroy,
  Decision,
};
