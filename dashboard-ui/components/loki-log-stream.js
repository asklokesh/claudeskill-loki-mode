/**
 * Loki Log Stream Component
 *
 * Real-time log display with filtering and auto-scroll.
 *
 * Usage:
 *   <loki-log-stream
 *     api-url="http://localhost:8420"
 *     max-lines="500"
 *     auto-scroll
 *     theme="dark"
 *   ></loki-log-stream>
 *
 * Attributes:
 *   - api-url: API base URL (default: http://localhost:8420)
 *   - max-lines: Maximum number of log lines to keep (default: 500)
 *   - auto-scroll: Enable auto-scroll to bottom
 *   - theme: 'light' or 'dark' (default: auto-detect)
 *   - log-file: Path to log file (for file-based updates)
 *
 * Events:
 *   - log-received: Fired when a new log message is received
 *   - logs-cleared: Fired when logs are cleared
 */

import { LokiElement } from '../core/loki-theme.js';
import { getApiClient, ApiEvents } from '../core/loki-api-client.js';

const LOG_LEVELS = {
  info: { color: 'var(--loki-blue)', label: 'INFO' },
  success: { color: 'var(--loki-green)', label: 'SUCCESS' },
  warning: { color: 'var(--loki-yellow)', label: 'WARN' },
  error: { color: 'var(--loki-red)', label: 'ERROR' },
  step: { color: 'var(--loki-purple)', label: 'STEP' },
  agent: { color: 'var(--loki-accent)', label: 'AGENT' },
  debug: { color: 'var(--loki-text-muted)', label: 'DEBUG' },
};

export class LokiLogStream extends LokiElement {
  static get observedAttributes() {
    return ['api-url', 'max-lines', 'auto-scroll', 'theme', 'log-file'];
  }

  constructor() {
    super();
    this._logs = [];
    this._maxLines = 500;
    this._autoScroll = true;
    this._filter = '';
    this._levelFilter = 'all';
    this._api = null;
    this._pollInterval = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._maxLines = parseInt(this.getAttribute('max-lines')) || 500;
    this._autoScroll = this.hasAttribute('auto-scroll');
    this._setupApi();
    this._startLogPolling();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopLogPolling();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'api-url':
        if (this._api) {
          this._api.baseUrl = newValue;
        }
        break;
      case 'max-lines':
        this._maxLines = parseInt(newValue) || 500;
        this._trimLogs();
        this.render();
        break;
      case 'auto-scroll':
        this._autoScroll = this.hasAttribute('auto-scroll');
        this.render();
        break;
      case 'theme':
        this._applyTheme();
        break;
    }
  }

  _setupApi() {
    const apiUrl = this.getAttribute('api-url') || 'http://localhost:8420';
    this._api = getApiClient({ baseUrl: apiUrl });

    this._api.addEventListener(ApiEvents.LOG_MESSAGE, (e) => {
      this._addLog(e.detail);
    });
  }

  _startLogPolling() {
    const logFile = this.getAttribute('log-file');
    if (logFile) {
      this._pollLogFile(logFile);
    }
    // WebSocket-based logs are handled via event listener
  }

  async _pollLogFile(logFile) {
    let lastSize = 0;

    const poll = async () => {
      try {
        const response = await fetch(`${logFile}?t=${Date.now()}`);
        if (!response.ok) return;

        const text = await response.text();
        const lines = text.split('\n');

        // Only process new lines
        if (lines.length > lastSize) {
          const newLines = lines.slice(lastSize);
          for (const line of newLines) {
            if (line.trim()) {
              this._addLog(this._parseLine(line));
            }
          }
          lastSize = lines.length;
        }
      } catch (error) {
        // Silently ignore file read errors
      }
    };

    poll();
    this._pollInterval = setInterval(poll, 1000);
  }

  _stopLogPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  _parseLine(line) {
    // Try to parse structured log format: [TIMESTAMP] [LEVEL] message
    const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)$/);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toLowerCase(),
        message: match[3],
      };
    }

    // Try simpler format: TIMESTAMP LEVEL message
    const simpleMatch = line.match(/^(\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+)$/);
    if (simpleMatch) {
      return {
        timestamp: simpleMatch[1],
        level: simpleMatch[2].toLowerCase(),
        message: simpleMatch[3],
      };
    }

    // Default: treat as info message
    return {
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: line,
    };
  }

  _addLog(log) {
    if (!log) return;

    const entry = {
      id: Date.now() + Math.random(),
      timestamp: log.timestamp || new Date().toLocaleTimeString(),
      level: (log.level || 'info').toLowerCase(),
      message: log.message || log,
    };

    this._logs.push(entry);
    this._trimLogs();

    this.dispatchEvent(new CustomEvent('log-received', { detail: entry }));

    this._renderLogs();

    if (this._autoScroll) {
      this._scrollToBottom();
    }
  }

  _trimLogs() {
    if (this._logs.length > this._maxLines) {
      this._logs = this._logs.slice(-this._maxLines);
    }
  }

  _clearLogs() {
    this._logs = [];
    this.dispatchEvent(new CustomEvent('logs-cleared'));
    this._renderLogs();
  }

  _toggleAutoScroll() {
    this._autoScroll = !this._autoScroll;
    this.render();
    if (this._autoScroll) {
      this._scrollToBottom();
    }
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      const output = this.shadowRoot.getElementById('log-output');
      if (output) {
        output.scrollTop = output.scrollHeight;
      }
    });
  }

  _downloadLogs() {
    const content = this._logs
      .map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loki-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _setFilter(filter) {
    this._filter = filter.toLowerCase();
    this._renderLogs();
  }

  _setLevelFilter(level) {
    this._levelFilter = level;
    this._renderLogs();
  }

  _getFilteredLogs() {
    return this._logs.filter(log => {
      // Level filter
      if (this._levelFilter !== 'all' && log.level !== this._levelFilter) {
        return false;
      }

      // Text filter
      if (this._filter && !log.message.toLowerCase().includes(this._filter)) {
        return false;
      }

      return true;
    });
  }

  _renderLogs() {
    const output = this.shadowRoot.getElementById('log-output');
    if (!output) return;

    const filteredLogs = this._getFilteredLogs();

    if (filteredLogs.length === 0) {
      output.innerHTML = '<div class="log-empty">No log output yet. Terminal will update when Loki Mode is running.</div>';
      return;
    }

    output.innerHTML = filteredLogs.map(log => {
      const levelConfig = LOG_LEVELS[log.level] || LOG_LEVELS.info;
      return `
        <div class="log-line">
          <span class="timestamp">${log.timestamp}</span>
          <span class="level" style="color: ${levelConfig.color}">[${levelConfig.label}]</span>
          <span class="message">${this._escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');

    if (this._autoScroll) {
      this._scrollToBottom();
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  render() {
    const styles = `
      <style>
        :host {
          display: block;
          ${this.getBaseStyles()}
        }

        .terminal-container {
          background: #1a1a1b;
          border: 1px solid var(--loki-border);
          border-radius: 10px;
          overflow: hidden;
        }

        .terminal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: #232325;
          border-bottom: 1px solid var(--loki-border);
        }

        .terminal-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #a1a1a6;
        }

        .terminal-dots {
          display: flex;
          gap: 6px;
        }

        .terminal-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .terminal-dot.red { background: #ff5f56; }
        .terminal-dot.yellow { background: #ffbd2e; }
        .terminal-dot.green { background: #27c93f; }

        .terminal-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .terminal-btn {
          padding: 4px 10px;
          background: #2a2a2d;
          border: 1px solid #3d3d42;
          border-radius: 4px;
          color: #a1a1a6;
          font-size: 11px;
          cursor: pointer;
          transition: all var(--loki-transition);
        }

        .terminal-btn:hover {
          background: #3d3d42;
          color: #f5f5f5;
        }

        .terminal-btn.active {
          background: var(--loki-accent);
          border-color: var(--loki-accent);
          color: white;
        }

        .filter-input {
          padding: 4px 10px;
          background: #2a2a2d;
          border: 1px solid #3d3d42;
          border-radius: 4px;
          color: #f5f5f5;
          font-size: 11px;
          width: 120px;
        }

        .filter-input:focus {
          outline: none;
          border-color: var(--loki-accent);
        }

        .filter-input::placeholder {
          color: #6b6b70;
        }

        .level-select {
          padding: 4px 10px;
          background: #2a2a2d;
          border: 1px solid #3d3d42;
          border-radius: 4px;
          color: #a1a1a6;
          font-size: 11px;
          cursor: pointer;
        }

        .log-output {
          padding: 14px;
          max-height: 350px;
          overflow-y: auto;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: #e5e5e5;
          background: #1a1a1b;
        }

        .log-line {
          display: flex;
          gap: 10px;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .log-line .timestamp {
          color: #6b6b70;
          flex-shrink: 0;
        }

        .log-line .level {
          flex-shrink: 0;
          font-weight: 500;
        }

        .log-line .message {
          flex: 1;
        }

        .log-empty {
          color: #6b6b70;
          text-align: center;
          padding: 40px;
        }

        .log-count {
          font-size: 10px;
          color: #6b6b70;
          padding: 4px 14px;
          border-top: 1px solid #2d2d30;
          background: #1a1a1b;
        }

        /* Scrollbar */
        .log-output::-webkit-scrollbar { width: 6px; }
        .log-output::-webkit-scrollbar-track { background: #1a1a1b; }
        .log-output::-webkit-scrollbar-thumb { background: #3d3d42; border-radius: 3px; }
        .log-output::-webkit-scrollbar-thumb:hover { background: #505055; }
      </style>
    `;

    this.shadowRoot.innerHTML = `
      ${styles}
      <div class="terminal-container">
        <div class="terminal-header">
          <div class="terminal-title">
            <div class="terminal-dots">
              <span class="terminal-dot red"></span>
              <span class="terminal-dot yellow"></span>
              <span class="terminal-dot green"></span>
            </div>
            loki-mode -- agent output
          </div>
          <div class="terminal-controls">
            <input type="text" class="filter-input" id="filter-input" placeholder="Filter logs...">
            <select class="level-select" id="level-select">
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="step">Step</option>
              <option value="agent">Agent</option>
              <option value="debug">Debug</option>
            </select>
            <button class="terminal-btn ${this._autoScroll ? 'active' : ''}" id="auto-scroll-btn" aria-label="Toggle auto-scroll" aria-pressed="${this._autoScroll}">Auto-scroll</button>
            <button class="terminal-btn" id="clear-btn" aria-label="Clear all logs">Clear</button>
            <button class="terminal-btn" id="download-btn" aria-label="Download logs as text file">Download</button>
          </div>
        </div>
        <div class="log-output" id="log-output" role="log" aria-live="polite" aria-label="Log output">
          <div class="log-empty">No log output yet. Terminal will update when Loki Mode is running.</div>
        </div>
        <div class="log-count">
          ${this._logs.length} lines (${this._getFilteredLogs().length} shown)
        </div>
      </div>
    `;

    this._attachEventListeners();
    this._renderLogs();
  }

  _attachEventListeners() {
    const filterInput = this.shadowRoot.getElementById('filter-input');
    const levelSelect = this.shadowRoot.getElementById('level-select');
    const autoScrollBtn = this.shadowRoot.getElementById('auto-scroll-btn');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    const downloadBtn = this.shadowRoot.getElementById('download-btn');

    if (filterInput) {
      filterInput.value = this._filter;
      filterInput.addEventListener('input', (e) => this._setFilter(e.target.value));
    }

    if (levelSelect) {
      levelSelect.value = this._levelFilter;
      levelSelect.addEventListener('change', (e) => this._setLevelFilter(e.target.value));
    }

    if (autoScrollBtn) {
      autoScrollBtn.addEventListener('click', () => this._toggleAutoScroll());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._clearLogs());
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this._downloadLogs());
    }
  }

  /**
   * Public API to add a log entry programmatically
   */
  addLog(message, level = 'info') {
    this._addLog({ message, level, timestamp: new Date().toLocaleTimeString() });
  }

  /**
   * Public API to clear all logs
   */
  clear() {
    this._clearLogs();
  }
}

// Register the component
customElements.define('loki-log-stream', LokiLogStream);

export default LokiLogStream;
