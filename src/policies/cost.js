'use strict';

/**
 * Loki Mode Policy Engine - Cost Control System
 *
 * Per-project token budget tracking with configurable alert thresholds.
 *
 * Features:
 *   - Per-project token budget tracking
 *   - Alerts at configurable thresholds (default: 50%, 80%, 100%)
 *   - Per-agent cost tracking (model type, tokens consumed, duration)
 *   - Kill switch: emits shutdown event when budget exceeded
 *   - Cost data persisted to .loki/state/costs.json
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// -------------------------------------------------------------------
// CostController class
// -------------------------------------------------------------------

class CostController extends EventEmitter {
  /**
   * @param {string} projectDir - Root directory containing .loki/
   * @param {Array} resourcePolicies - Resource policy entries from engine
   */
  constructor(projectDir, resourcePolicies) {
    super();
    this._projectDir = projectDir || process.cwd();
    this._stateFile = path.join(this._projectDir, '.loki', 'state', 'costs.json');
    this._state = this._loadState();
    this._budgetConfig = this._extractBudgetConfig(resourcePolicies || []);
    this._triggeredAlerts = new Set();
    // Per-project shutdown flags (keyed by projectId or 'global').
    // Using a Set instead of a single boolean ensures each project only
    // emits shutdown once even when multiple projects are tracked.
    this._shutdownEmittedProjects = new Set();

    // Restore previously triggered alerts
    if (this._state.triggeredAlerts) {
      for (let i = 0; i < this._state.triggeredAlerts.length; i++) {
        this._triggeredAlerts.add(this._state.triggeredAlerts[i]);
      }
    }
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
      // Corrupted file -- start fresh
    }
    return {
      projects: {},
      agents: {},
      totalTokens: 0,
      triggeredAlerts: [],
      history: [],
    };
  }

  _saveState() {
    const dir = path.dirname(this._stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this._state.triggeredAlerts = Array.from(this._triggeredAlerts);
    fs.writeFileSync(this._stateFile, JSON.stringify(this._state, null, 2), 'utf8');
  }

  _extractBudgetConfig(resourcePolicies) {
    for (let i = 0; i < resourcePolicies.length; i++) {
      const p = resourcePolicies[i];
      if (p.max_tokens) {
        return {
          maxTokens: p.max_tokens,
          alerts: p.alerts || [50, 80, 100],
          onExceed: p.on_exceed || 'shutdown',
          name: p.name,
        };
      }
    }
    return null;
  }

  // -----------------------------------------------------------------
  // Token recording
  // -----------------------------------------------------------------

  /**
   * Record tokens consumed by an agent.
   *
   * @param {string} projectId - Project identifier
   * @param {object} usage - { agentId, model, tokens, durationMs }
   */
  recordUsage(projectId, usage) {
    const { agentId, model, tokens, durationMs } = usage || {};
    const tokenCount = tokens || 0;

    // Update project totals
    if (!this._state.projects[projectId]) {
      this._state.projects[projectId] = { totalTokens: 0, entries: [] };
    }
    this._state.projects[projectId].totalTokens += tokenCount;
    this._state.projects[projectId].entries.push({
      agentId: agentId || 'unknown',
      model: model || 'unknown',
      tokens: tokenCount,
      durationMs: durationMs || 0,
      timestamp: new Date().toISOString(),
    });

    // Update agent totals
    const agentKey = agentId || 'unknown';
    if (!this._state.agents[agentKey]) {
      this._state.agents[agentKey] = { totalTokens: 0, model: model, entries: 0 };
    }
    this._state.agents[agentKey].totalTokens += tokenCount;
    this._state.agents[agentKey].entries += 1;

    // Update global total
    this._state.totalTokens += tokenCount;

    // Check alerts and budget
    this._checkAlerts(projectId);

    this._saveState();
  }

  // -----------------------------------------------------------------
  // Budget checking
  // -----------------------------------------------------------------

  /**
   * Check the budget status for a project (or globally).
   *
   * @param {string} [projectId] - Project identifier (if omitted, checks global)
   * @returns {{ remaining: number, percentage: number, alerts: Array, exceeded: boolean }}
   */
  checkBudget(projectId) {
    if (!this._budgetConfig) {
      return {
        remaining: Infinity,
        percentage: 0,
        alerts: [],
        exceeded: false,
      };
    }

    const consumed = projectId && this._state.projects[projectId]
      ? this._state.projects[projectId].totalTokens
      : this._state.totalTokens;

    const max = this._budgetConfig.maxTokens;
    const percentage = max > 0 ? Math.round((consumed / max) * 100) : 0;
    const remaining = Math.max(0, max - consumed);
    const exceeded = consumed >= max;

    // Collect active alerts
    const alerts = [];
    const thresholds = this._budgetConfig.alerts;
    for (let i = 0; i < thresholds.length; i++) {
      if (percentage >= thresholds[i]) {
        alerts.push({
          threshold: thresholds[i],
          message: 'Token usage at ' + percentage + '% (threshold: ' + thresholds[i] + '%)',
        });
      }
    }

    return { remaining, percentage, alerts, exceeded };
  }

  _checkAlerts(projectId) {
    if (!this._budgetConfig) return;

    const budget = this.checkBudget(projectId);

    // Emit alert events for newly triggered thresholds
    const thresholds = this._budgetConfig.alerts;
    for (let i = 0; i < thresholds.length; i++) {
      const key = (projectId || 'global') + ':' + thresholds[i];
      if (budget.percentage >= thresholds[i] && !this._triggeredAlerts.has(key)) {
        this._triggeredAlerts.add(key);

        this._state.history.push({
          type: 'alert',
          threshold: thresholds[i],
          percentage: budget.percentage,
          projectId: projectId || 'global',
          timestamp: new Date().toISOString(),
        });

        this.emit('alert', {
          threshold: thresholds[i],
          percentage: budget.percentage,
          projectId: projectId,
          remaining: budget.remaining,
        });
      }
    }

    // Kill switch (per-project: each project emits shutdown at most once)
    const shutdownKey = projectId || 'global';
    if (budget.exceeded && !this._shutdownEmittedProjects.has(shutdownKey)) {
      if (this._budgetConfig.onExceed === 'shutdown') {
        this._shutdownEmittedProjects.add(shutdownKey);

        this._state.history.push({
          type: 'shutdown',
          reason: 'Budget exceeded',
          percentage: budget.percentage,
          projectId: projectId || 'global',
          timestamp: new Date().toISOString(),
        });

        this._saveState();
        this.emit('shutdown', {
          reason: 'Token budget exceeded',
          projectId: projectId,
          percentage: budget.percentage,
          consumed: this._state.totalTokens,
          max: this._budgetConfig.maxTokens,
        });
      }
    }
  }

  // -----------------------------------------------------------------
  // Reporting
  // -----------------------------------------------------------------

  /**
   * Get per-agent cost report.
   */
  getAgentReport() {
    return Object.assign({}, this._state.agents);
  }

  /**
   * Get per-project cost report.
   */
  getProjectReport(projectId) {
    if (projectId) {
      return this._state.projects[projectId] || null;
    }
    return Object.assign({}, this._state.projects);
  }

  /**
   * Get the history of alerts and shutdown events.
   */
  getHistory() {
    return this._state.history.slice();
  }

  /**
   * Reset all cost tracking data.
   */
  reset() {
    this._state = {
      projects: {},
      agents: {},
      totalTokens: 0,
      triggeredAlerts: [],
      history: [],
    };
    this._triggeredAlerts.clear();
    this._shutdownEmittedProjects.clear();
    this._saveState();
  }
}

// -------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------

module.exports = { CostController };
