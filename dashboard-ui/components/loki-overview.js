/**
 * @fileoverview Loki Overview Component - displays system overview cards
 * in a responsive grid showing session status, phase, iteration, provider,
 * agents, tasks, uptime, and complexity.
 *
 * Polls /api/status every 5 seconds and listens to ApiEvents.STATUS_UPDATE
 * for immediate updates.
 *
 * @example
 * <loki-overview api-url="http://localhost:57374" theme="dark"></loki-overview>
 */

import { LokiElement } from '../core/loki-theme.js';
import { getApiClient, ApiEvents } from '../core/loki-api-client.js';

/**
 * @class LokiOverview
 * @extends LokiElement
 * @property {string} api-url - API base URL (default: window.location.origin)
 * @property {string} theme - 'light' or 'dark' (default: auto-detect)
 */
export class LokiOverview extends LokiElement {
  static get observedAttributes() {
    return ['api-url', 'theme'];
  }

  constructor() {
    super();
    this._data = {
      status: 'offline',
      phase: null,
      iteration: null,
      provider: null,
      running_agents: 0,
      pending_tasks: null,
      uptime_seconds: 0,
      complexity: null,
      connected: false,
    };
    this._api = null;
    this._pollInterval = null;
    this._statusUpdateHandler = null;
    this._connectedHandler = null;
    this._disconnectedHandler = null;
    this._checklistSummary = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._setupApi();
    this._loadStatus();
    this._startPolling();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPolling();
    if (this._api) {
      if (this._statusUpdateHandler) this._api.removeEventListener(ApiEvents.STATUS_UPDATE, this._statusUpdateHandler);
      if (this._connectedHandler) this._api.removeEventListener(ApiEvents.CONNECTED, this._connectedHandler);
      if (this._disconnectedHandler) this._api.removeEventListener(ApiEvents.DISCONNECTED, this._disconnectedHandler);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'api-url' && this._api) {
      this._api.baseUrl = newValue;
      this._loadStatus();
    }
    if (name === 'theme') {
      this._applyTheme();
    }
  }

  _setupApi() {
    const apiUrl = this.getAttribute('api-url') || window.location.origin;
    this._api = getApiClient({ baseUrl: apiUrl });

    this._statusUpdateHandler = (e) => this._updateFromStatus(e.detail);
    this._connectedHandler = () => { this._data.connected = true; this.render(); };
    this._disconnectedHandler = () => { this._data.connected = false; this._data.status = 'offline'; this.render(); };

    this._api.addEventListener(ApiEvents.STATUS_UPDATE, this._statusUpdateHandler);
    this._api.addEventListener(ApiEvents.CONNECTED, this._connectedHandler);
    this._api.addEventListener(ApiEvents.DISCONNECTED, this._disconnectedHandler);
  }

  async _loadStatus() {
    try {
      const [status, checklistSummary] = await Promise.allSettled([
        this._api.getStatus(),
        this._api.getChecklistSummary(),
      ]);
      if (status.status === 'fulfilled') {
        this._updateFromStatus(status.value);
      } else {
        this._data.connected = false;
        this._data.status = 'offline';
      }
      if (checklistSummary.status === 'fulfilled') {
        this._checklistSummary = checklistSummary.value?.summary || null;
      }
      this.render();
    } catch (error) {
      this._data.connected = false;
      this._data.status = 'offline';
      this.render();
    }
  }

  _updateFromStatus(status) {
    if (!status) return;

    this._data = {
      ...this._data,
      connected: true,
      status: status.status || 'offline',
      phase: status.phase || null,
      iteration: status.iteration != null ? status.iteration : null,
      provider: status.provider || null,
      running_agents: status.running_agents || 0,
      pending_tasks: status.pending_tasks != null ? status.pending_tasks : null,
      uptime_seconds: status.uptime_seconds || 0,
      complexity: status.complexity || null,
    };

    this.render();
  }

  _startPolling() {
    this._pollInterval = setInterval(async () => {
      try {
        const status = await this._api.getStatus();
        this._updateFromStatus(status);
      } catch (error) {
        this._data.connected = false;
        this._data.status = 'offline';
        this.render();
      }
    }, 5000);
  }

  _stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  _formatUptime(seconds) {
    if (!seconds || seconds < 0) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  _getStatusDotClass() {
    switch (this._data.status) {
      case 'running':
      case 'autonomous':
        return 'active';
      case 'paused':
        return 'paused';
      case 'stopped':
        return 'stopped';
      case 'error':
        return 'error';
      default:
        return 'offline';
    }
  }

  _renderChecklistCard() {
    const s = this._checklistSummary;
    if (!s || !s.total) {
      return `
        <div class="overview-card">
          <div class="card-label">PRD Progress</div>
          <div class="card-value small-text">--</div>
        </div>
      `;
    }
    const pct = Math.round((s.verified / s.total) * 100);
    const barColor = s.failing > 0 ? 'var(--loki-yellow, #f59e0b)' : 'var(--loki-green, #22c55e)';
    return `
      <div class="overview-card">
        <div class="card-label">PRD Progress</div>
        <div class="card-value small-text">${s.verified}/${s.total} (${pct}%)</div>
        <div class="mini-progress" style="margin-top:4px;height:4px;background:var(--loki-bg-secondary,#e4e4e7);border-radius:2px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${barColor};transition:width 0.3s;"></div>
        </div>
        ${s.failing ? `<div style="font-size:10px;color:var(--loki-red,#ef4444);margin-top:2px;">${s.failing} failing</div>` : ''}
      </div>
    `;
  }

  render() {
    const statusDotClass = this._getStatusDotClass();
    const statusLabel = (this._data.status || 'OFFLINE').toUpperCase();
    const phase = this._data.phase || '--';
    const iteration = this._data.iteration != null ? String(this._data.iteration) : '0';
    const provider = (this._data.provider || 'CLAUDE').toUpperCase();
    const agents = String(this._data.running_agents || 0);
    const tasks = this._data.pending_tasks != null ? `${this._data.pending_tasks} pending` : '--';
    const uptime = this._formatUptime(this._data.uptime_seconds);
    const complexity = (this._data.complexity || 'STANDARD').toUpperCase();

    this.shadowRoot.innerHTML = `
      <style>
        ${this.getBaseStyles()}

        :host {
          display: block;
        }

        .overview-container {
          background: var(--loki-bg-card);
          border: 1px solid var(--loki-border);
          border-radius: 10px;
          padding: 16px;
          transition: all var(--loki-transition);
        }

        .overview-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }

        .overview-header svg {
          width: 16px;
          height: 16px;
          color: var(--loki-text-muted);
          flex-shrink: 0;
        }

        .overview-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--loki-text-muted);
        }

        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }

        .overview-card {
          background: var(--loki-bg-tertiary);
          border-radius: 8px;
          padding: 12px 14px;
          transition: background var(--loki-transition);
        }

        .overview-card:hover {
          background: var(--loki-bg-hover);
        }

        .card-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--loki-text-muted);
          margin-bottom: 6px;
        }

        .card-value {
          font-size: 18px;
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
          color: var(--loki-text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
          line-height: 1.2;
        }

        .card-value.small-text {
          font-size: 14px;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .status-dot.active {
          background: var(--loki-green);
          animation: pulse 2s infinite;
        }

        .status-dot.paused {
          background: var(--loki-yellow);
        }

        .status-dot.stopped {
          background: var(--loki-red);
        }

        .status-dot.error {
          background: var(--loki-red);
        }

        .status-dot.offline {
          background: var(--loki-text-muted);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>

      <div class="overview-container">
        <div class="overview-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span class="overview-title">Overview</span>
        </div>

        <div class="overview-grid">
          <div class="overview-card">
            <div class="card-label">Session</div>
            <div class="card-value">
              <span class="status-dot ${statusDotClass}"></span>
              ${statusLabel}
            </div>
          </div>

          <div class="overview-card">
            <div class="card-label">Phase</div>
            <div class="card-value small-text">${phase}</div>
          </div>

          <div class="overview-card">
            <div class="card-label">Iteration</div>
            <div class="card-value">${iteration}</div>
          </div>

          <div class="overview-card">
            <div class="card-label">Provider</div>
            <div class="card-value small-text">${provider}</div>
          </div>

          <div class="overview-card">
            <div class="card-label">Agents</div>
            <div class="card-value">${agents}</div>
          </div>

          <div class="overview-card">
            <div class="card-label">Tasks</div>
            <div class="card-value small-text">${tasks}</div>
          </div>

          ${this._renderChecklistCard()}

          <div class="overview-card">
            <div class="card-label">Uptime</div>
            <div class="card-value small-text">${uptime}</div>
          </div>

          <div class="overview-card">
            <div class="card-label">Complexity</div>
            <div class="card-value small-text">${complexity}</div>
          </div>
        </div>
      </div>
    `;
  }
}

// Register the component
if (!customElements.get('loki-overview')) {
  customElements.define('loki-overview', LokiOverview);
}

export default LokiOverview;
