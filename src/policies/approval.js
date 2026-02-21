'use strict';

/**
 * Loki Mode Policy Engine - Approval Gate System
 *
 * Manages configurable approval breakpoints that pause execution
 * at specified phases.
 *
 * Features:
 *   - Configurable breakpoints by phase name
 *   - Webhook callback for async approval (POST to configured URL)
 *   - Auto-approve after configurable timeout (default: 30 minutes)
 *   - Approval state persisted to .loki/state/approvals.json
 *   - Full audit trail of all approval decisions
 *
 * The webhook is fire-and-forget: POST is sent and response handled async.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

const DEFAULT_TIMEOUT_MINUTES = 30;
const APPROVAL_STATES = ['pending', 'approved', 'rejected', 'timed_out'];

// -------------------------------------------------------------------
// ApprovalGateManager class
// -------------------------------------------------------------------

class ApprovalGateManager {
  /**
   * @param {string} projectDir - Root directory containing .loki/
   * @param {Array} gates - Array of gate definitions from policies
   */
  constructor(projectDir, gates) {
    this._projectDir = projectDir || process.cwd();
    this._gates = gates || [];
    this._stateFile = path.join(this._projectDir, '.loki', 'state', 'approvals.json');
    this._state = this._loadState();
    this._pendingTimers = {};
  }

  // -----------------------------------------------------------------
  // State persistence
  // -----------------------------------------------------------------

  _loadState() {
    try {
      if (fs.existsSync(this._stateFile)) {
        const raw = fs.readFileSync(this._stateFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (_) {
      // Corrupted state file -- start fresh
    }
    return { requests: [], audit: [] };
  }

  _saveState() {
    const dir = path.dirname(this._stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this._stateFile, JSON.stringify(this._state, null, 2), 'utf8');
  }

  // -----------------------------------------------------------------
  // Gate lookup
  // -----------------------------------------------------------------

  /**
   * Find the gate definition for a given phase.
   */
  findGate(phase) {
    for (let i = 0; i < this._gates.length; i++) {
      if (this._gates[i].phase === phase) {
        return this._gates[i];
      }
    }
    return null;
  }

  /**
   * Check if a phase requires an approval gate.
   */
  hasGate(phase) {
    return this.findGate(phase) !== null;
  }

  // -----------------------------------------------------------------
  // Request approval
  // -----------------------------------------------------------------

  /**
   * Request approval for a gate. Returns a Promise that resolves when
   * approved/rejected/timed-out.
   *
   * @param {string} phase - The phase name (e.g., "deploy")
   * @param {object} context - Contextual data about the request
   * @returns {Promise<{approved: boolean, reason: string, method: string}>}
   */
  requestApproval(phase, context) {
    const gate = this.findGate(phase);
    if (!gate) {
      // No gate for this phase -- auto-approve
      return Promise.resolve({
        approved: true,
        reason: 'No approval gate configured for phase: ' + phase,
        method: 'auto',
      });
    }

    const requestId = 'apr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    const timeout = (gate.timeout_minutes || DEFAULT_TIMEOUT_MINUTES) * 60 * 1000;

    const request = {
      id: requestId,
      phase: phase,
      gate: gate.name,
      status: 'pending',
      context: context || {},
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      method: null,
      reason: null,
    };

    this._state.requests.push(request);
    this._saveState();

    // Fire webhook (fire-and-forget)
    if (gate.webhook) {
      this._sendWebhook(gate.webhook, request);
    }

    const self = this;

    return new Promise(function (resolve) {
      // Set timeout for auto-approve
      const timer = setTimeout(function () {
        delete self._pendingTimers[requestId];
        request.status = 'timed_out';
        request.resolvedAt = new Date().toISOString();
        request.method = 'timeout';
        request.reason = 'Auto-approved after ' + (gate.timeout_minutes || DEFAULT_TIMEOUT_MINUTES) + ' minute timeout';
        self._addAudit(request);
        self._saveState();
        resolve({
          approved: true,
          reason: request.reason,
          method: 'timeout',
        });
      }, timeout);

      // Store resolver so external approval can trigger it
      self._pendingTimers[requestId] = {
        timer: timer,
        resolve: resolve,
        request: request,
      };
    });
  }

  /**
   * Resolve a pending approval externally (e.g., via webhook callback).
   *
   * @param {string} requestId - The approval request ID
   * @param {boolean} approved - Whether to approve or reject
   * @param {string} [reason] - Reason for the decision
   * @returns {boolean} - Whether the request was found and resolved
   */
  resolveApproval(requestId, approved, reason) {
    const pending = this._pendingTimers[requestId];
    if (!pending) return false;

    clearTimeout(pending.timer);
    delete this._pendingTimers[requestId];

    const request = pending.request;
    request.status = approved ? 'approved' : 'rejected';
    request.resolvedAt = new Date().toISOString();
    request.method = 'manual';
    request.reason = reason || (approved ? 'Manually approved' : 'Manually rejected');

    this._addAudit(request);
    this._saveState();

    pending.resolve({
      approved: approved,
      reason: request.reason,
      method: 'manual',
    });

    return true;
  }

  // -----------------------------------------------------------------
  // Webhook
  // -----------------------------------------------------------------

  _sendWebhook(url, request) {
    try {
      const payload = JSON.stringify({
        type: 'approval_request',
        id: request.id,
        phase: request.phase,
        gate: request.gate,
        context: request.context,
        createdAt: request.createdAt,
      });

      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const opts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 5000,
      };

      const req = transport.request(opts, function () {
        // Fire-and-forget: ignore response
      });
      req.on('error', function () {
        // Silently ignore webhook failures
      });
      req.write(payload);
      req.end();
    } catch (_) {
      // Ignore any errors in webhook sending
    }
  }

  // -----------------------------------------------------------------
  // Audit trail
  // -----------------------------------------------------------------

  _addAudit(request) {
    this._state.audit.push({
      id: request.id,
      phase: request.phase,
      gate: request.gate,
      status: request.status,
      method: request.method,
      reason: request.reason,
      createdAt: request.createdAt,
      resolvedAt: request.resolvedAt,
    });
  }

  /**
   * Get the full audit trail.
   */
  getAuditTrail() {
    return this._state.audit.slice();
  }

  /**
   * Get all pending requests.
   */
  getPendingRequests() {
    return this._state.requests.filter(function (r) {
      return r.status === 'pending';
    });
  }

  // -----------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------

  /**
   * Cancel all pending timers and clean up.
   */
  destroy() {
    const ids = Object.keys(this._pendingTimers);
    for (let i = 0; i < ids.length; i++) {
      clearTimeout(this._pendingTimers[ids[i]].timer);
    }
    this._pendingTimers = {};
  }
}

// -------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------

module.exports = { ApprovalGateManager, DEFAULT_TIMEOUT_MINUTES, APPROVAL_STATES };
