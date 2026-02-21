'use strict';

const crypto = require('crypto');
const { IntegrationAdapter } = require('../adapter');
const { LinearClient } = require('./client');
const { loadConfig, validateConfig } = require('./config');

/**
 * RARV phase to Linear status mapping (defaults, overridable via config).
 * REASON -> In Progress (analysis/planning phase)
 * ACT -> In Progress (implementation phase)
 * REFLECT -> In Review (quality check)
 * VERIFY -> Done (verified complete)
 */
const RARV_STATUS_MAP = {
  REASON: 'In Progress',
  ACT: 'In Progress',
  REFLECT: 'In Review',
  VERIFY: 'Done',
  DONE: 'Done',
};

/**
 * Linear priority number to text mapping.
 */
const PRIORITY_MAP = {
  0: 'none',
  1: 'urgent',
  2: 'high',
  3: 'medium',
  4: 'low',
};

/**
 * Linear bidirectional sync adapter.
 * Converts between Linear issues/projects and Loki Mode PRD format.
 * Designed as the reference adapter pattern for Jira, Slack, and Teams to follow.
 */
class LinearSync extends IntegrationAdapter {
  /**
   * @param {object} [config] - Pre-loaded config, or null to load from disk
   * @param {object} [options] - Adapter options (maxRetries, baseDelay, etc.)
   */
  constructor(config, options = {}) {
    super('linear', options);

    this.config = config || null;
    this.client = null;
    this._stateCache = new Map(); // teamId -> states[]
  }

  /**
   * Initialize the sync adapter. Loads config if not provided.
   * Must be called before using any sync methods.
   * @param {string} [configDir] - Config directory path
   * @returns {boolean} true if initialized, false if no config found
   */
  init(configDir) {
    if (!this.config) {
      this.config = loadConfig(configDir);
    }
    if (!this.config) return false;

    const validation = validateConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid Linear config: ${validation.errors.join(', ')}`);
    }

    this.client = new LinearClient(this.config.apiKey);
    return true;
  }

  /**
   * Import a Linear issue or project and convert to PRD format.
   * @param {string} externalId - Linear issue or project ID
   * @returns {Promise<object>} PRD-formatted object
   */
  async importProject(externalId) {
    this._ensureInitialized();

    return this.withRetry('importProject', async () => {
      // Try as issue first, fall back to project
      let issue;
      try {
        issue = await this.client.getIssue(externalId);
      } catch (e) {
        // Not an issue, try project
        const project = await this.client.getProject(externalId);
        return this._projectToPrd(project);
      }

      return this._issueToPrd(issue);
    });
  }

  /**
   * Sync RARV status back to Linear.
   * @param {string} projectId - Linear issue ID
   * @param {string} status - RARV status
   * @param {object} [details] - Additional details
   * @returns {Promise<object>}
   */
  async syncStatus(projectId, status, details) {
    this._ensureInitialized();

    const mapping = this.config.statusMapping || RARV_STATUS_MAP;
    const linearStatus = mapping[status] || mapping.ACT;

    return this.withRetry('syncStatus', async () => {
      // Get the issue to find its team
      const issue = await this.client.getIssue(projectId);
      if (!issue) {
        throw new Error(`Issue ${projectId} not found`);
      }

      // Find the state ID matching the target status name
      const teamId = this.config.teamId || await this._getTeamIdFromIssue(issue);
      const stateId = await this._resolveStateId(teamId, linearStatus);

      const result = await this.client.updateIssue(projectId, { stateId });

      // Post status comment with details if provided
      if (details && details.message) {
        const commentBody = `**Loki Mode [${status}]**: ${details.message}`;
        await this.client.createComment(projectId, commentBody);
      }

      this.emit('status-synced', {
        externalId: projectId,
        status,
        linearStatus,
        stateId,
      });

      return result;
    });
  }

  /**
   * Post a comment to a Linear issue.
   * @param {string} externalId - Linear issue ID
   * @param {string} content - Markdown content
   * @returns {Promise<object>}
   */
  async postComment(externalId, content) {
    this._ensureInitialized();

    return this.withRetry('postComment', async () => {
      const result = await this.client.createComment(externalId, content);
      this.emit('comment-posted', { externalId, commentId: result.comment?.id });
      return result;
    });
  }

  /**
   * Create subtasks in Linear mirroring internal task decomposition.
   * @param {string} externalId - Parent Linear issue ID
   * @param {Array<{title: string, description: string}>} tasks
   * @returns {Promise<Array<object>>}
   */
  async createSubtasks(externalId, tasks) {
    this._ensureInitialized();

    return this.withRetry('createSubtasks', async () => {
      const issue = await this.client.getIssue(externalId);
      const teamId = this.config.teamId || await this._getTeamIdFromIssue(issue);

      const results = [];
      for (const task of tasks) {
        const result = await this.client.createSubIssue(
          externalId,
          teamId,
          task.title,
          task.description || ''
        );
        results.push(result);
      }

      this.emit('subtasks-created', {
        externalId,
        count: results.length,
      });

      return results;
    });
  }

  /**
   * Return an HTTP handler for Linear webhook events.
   * Verifies webhook signature if webhook_secret is configured.
   * @returns {function} (req, res) => void
   */
  getWebhookHandler() {
    const self = this;

    return function webhookHandler(req, res) {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        // Verify signature if webhook secret is configured
        if (self.config && self.config.webhookSecret) {
          const signature = req.headers['linear-signature'];
          if (!self._verifyWebhookSignature(body, signature)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid signature' }));
            return;
          }
        }

        let payload;
        try {
          payload = JSON.parse(body);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        // Process webhook event
        const event = self._processWebhookEvent(payload);
        self.emit('webhook', event);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    };
  }

  // --- Internal helpers ---

  _ensureInitialized() {
    if (!this.client) {
      throw new Error('LinearSync not initialized. Call init() first.');
    }
  }

  /**
   * Convert a Linear issue to PRD format.
   */
  _issueToPrd(issue) {
    const labels = (issue.labels?.nodes || []).map((l) => l.name);
    const priority = PRIORITY_MAP[issue.priority] || 'medium';

    const dependencies = (issue.relations?.nodes || [])
      .filter((r) => r.type === 'blocks' || r.type === 'related')
      .map((r) => ({
        id: r.relatedIssue.id,
        identifier: r.relatedIssue.identifier,
        title: r.relatedIssue.title,
        type: r.type,
      }));

    const subtasks = (issue.children?.nodes || []).map((child) => ({
      id: child.id,
      identifier: child.identifier,
      title: child.title,
      status: child.state?.name || 'unknown',
    }));

    return {
      source: 'linear',
      externalId: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || '',
      priority,
      labels,
      status: issue.state?.name || 'unknown',
      statusType: issue.state?.type || 'unknown',
      assignee: issue.assignee ? {
        name: issue.assignee.name,
        email: issue.assignee.email,
      } : null,
      url: issue.url,
      dependencies,
      subtasks,
      prd: {
        overview: issue.title,
        description: issue.description || '',
        requirements: this._extractRequirements(issue.description || ''),
        priority,
        tags: labels,
      },
    };
  }

  /**
   * Convert a Linear project to PRD format.
   */
  _projectToPrd(project) {
    const issues = (project.issues?.nodes || []).map((issue) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || '',
      priority: PRIORITY_MAP[issue.priority] || 'medium',
      status: issue.state?.name || 'unknown',
      labels: (issue.labels?.nodes || []).map((l) => l.name),
    }));

    return {
      source: 'linear',
      externalId: project.id,
      title: project.name,
      description: project.description || '',
      status: project.state,
      url: project.url,
      lead: project.lead ? project.lead.name : null,
      issues,
      prd: {
        overview: project.name,
        description: project.description || '',
        requirements: issues.map((i) => i.title),
        tasks: issues,
      },
    };
  }

  /**
   * Extract requirement-like lines from a description.
   * Looks for markdown list items, numbered items, or lines starting with requirement-like keywords.
   */
  _extractRequirements(description) {
    if (!description) return [];
    const lines = description.split('\n');
    const reqs = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        reqs.push(trimmed.replace(/^[-*\d.]+\s+/, ''));
      }
    }
    return reqs;
  }

  /**
   * Resolve a status name to a Linear state ID for a given team.
   */
  async _resolveStateId(teamId, statusName) {
    if (!this._stateCache.has(teamId)) {
      const states = await this.client.getTeamStates(teamId);
      this._stateCache.set(teamId, states);
    }
    const states = this._stateCache.get(teamId);
    const state = states.find(
      (s) => s.name.toLowerCase() === statusName.toLowerCase()
    );
    if (!state) {
      throw new Error(`State "${statusName}" not found for team ${teamId}`);
    }
    return state.id;
  }

  /**
   * Extract team ID from an issue's identifier (e.g., "ENG-123" -> look up "ENG" team).
   * Falls back to requiring teamId in config.
   */
  async _getTeamIdFromIssue(issue) {
    // Linear issue identifiers are formatted as TEAM-NUMBER
    // We need the team ID, which requires a separate query.
    // For now, if no teamId in config, this is an error.
    if (this.config.teamId) return this.config.teamId;
    throw new Error(
      'Cannot determine team ID from issue. Set team_id in Linear integration config.'
    );
  }

  /**
   * Verify Linear webhook signature using HMAC-SHA256.
   */
  _verifyWebhookSignature(body, signature) {
    if (!signature || !this.config.webhookSecret) return false;
    const hmac = crypto.createHmac('sha256', this.config.webhookSecret);
    hmac.update(body);
    const expected = hmac.digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Process a Linear webhook payload into a normalized event.
   */
  _processWebhookEvent(payload) {
    const { action, type, data, updatedFrom } = payload;

    return {
      action: action || 'unknown',
      type: type || 'unknown',
      data: data || {},
      updatedFrom: updatedFrom || null,
      timestamp: new Date().toISOString(),
      processed: true,
    };
  }
}

module.exports = { LinearSync, RARV_STATUS_MAP, PRIORITY_MAP };
