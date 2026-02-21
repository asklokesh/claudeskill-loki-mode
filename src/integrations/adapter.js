'use strict';

const { EventEmitter } = require('events');

/**
 * Base integration adapter interface.
 * All external integrations (Linear, Jira, Slack, Teams) must extend this class.
 * Provides retry logic with exponential backoff and event emission for sync lifecycle.
 */
class IntegrationAdapter extends EventEmitter {
  /**
   * @param {string} name - Integration name (e.g., 'linear', 'jira')
   * @param {object} [options]
   * @param {number} [options.maxRetries=3] - Maximum retry attempts
   * @param {number} [options.baseDelay=1000] - Base delay in ms for exponential backoff
   * @param {number} [options.maxDelay=30000] - Maximum delay cap in ms
   */
  constructor(name, options = {}) {
    super();
    if (new.target === IntegrationAdapter) {
      throw new Error('IntegrationAdapter is abstract and cannot be instantiated directly');
    }
    this.name = name;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
  }

  /**
   * Import a project/issue from the external system and convert to PRD format.
   * @param {string} externalId - External system identifier
   * @returns {Promise<object>} PRD-formatted object
   */
  async importProject(externalId) {
    throw new Error(`${this.name}: importProject() not implemented`);
  }

  /**
   * Sync RARV status back to the external system.
   * @param {string} projectId - Internal project ID
   * @param {string} status - RARV status (REASON, ACT, REFLECT, VERIFY, DONE)
   * @param {object} [details] - Additional status details
   * @returns {Promise<object>} Sync result
   */
  async syncStatus(projectId, status, details) {
    throw new Error(`${this.name}: syncStatus() not implemented`);
  }

  /**
   * Post a comment to the external system (e.g., quality report).
   * @param {string} externalId - External system identifier
   * @param {string} content - Comment content (markdown)
   * @returns {Promise<object>} Comment result
   */
  async postComment(externalId, content) {
    throw new Error(`${this.name}: postComment() not implemented`);
  }

  /**
   * Create subtasks in the external system mirroring internal task decomposition.
   * @param {string} externalId - Parent external identifier
   * @param {Array<{title: string, description: string}>} tasks - Tasks to create
   * @returns {Promise<Array<object>>} Created subtask results
   */
  async createSubtasks(externalId, tasks) {
    throw new Error(`${this.name}: createSubtasks() not implemented`);
  }

  /**
   * Return an HTTP request handler for inbound webhook events.
   * The handler receives (req, res) and processes external system notifications.
   * @returns {function} HTTP request handler (req, res) => void
   */
  getWebhookHandler() {
    throw new Error(`${this.name}: getWebhookHandler() not implemented`);
  }

  /**
   * Execute an async function with exponential backoff retry.
   * Emits 'retry', 'success', and 'failure' events.
   * @param {string} operation - Operation name for logging
   * @param {function} fn - Async function to execute
   * @returns {Promise<*>} Result of fn
   */
  async withRetry(operation, fn) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await fn();
        this.emit('success', { integration: this.name, operation, attempt });
        return result;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = Math.min(
            this.baseDelay * Math.pow(2, attempt),
            this.maxDelay
          );
          this.emit('retry', {
            integration: this.name,
            operation,
            attempt: attempt + 1,
            delay,
            error: err.message,
          });
          await this._sleep(delay);
        }
      }
    }
    this.emit('failure', {
      integration: this.name,
      operation,
      error: lastError.message,
      attempts: this.maxRetries + 1,
    });
    throw lastError;
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { IntegrationAdapter };
