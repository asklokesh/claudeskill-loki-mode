'use strict';

var crypto = require('crypto');

var SUPPORTED_EVENTS = ['jira:issue_created', 'jira:issue_updated', 'sprint_started'];

/**
 * Jira Webhook Handler.
 */
class WebhookHandler {
  /**
   * @param {object} opts
   * @param {string} [opts.secret] - Webhook secret for signature verification
   * @param {function} [opts.onEpicCreated] - Callback for new epics
   * @param {function} [opts.onIssueUpdated] - Callback for issue updates
   * @param {string[]} [opts.issueTypes] - Issue types to process (default: ['Epic', 'Story'])
   */
  constructor(opts) {
    opts = opts || {};
    this._secret = opts.secret || null;
    this._onEpicCreated = opts.onEpicCreated || null;
    this._onIssueUpdated = opts.onIssueUpdated || null;
    this._issueTypes = opts.issueTypes || ['Epic', 'Story'];
  }

  /**
   * Handle an incoming webhook request.
   * @param {object} headers - Request headers
   * @param {string|Buffer} rawBody - Raw request body
   * @returns {{ status: number, response: object }}
   */
  handleRequest(headers, rawBody) {
    // Verify signature if secret is configured
    if (this._secret) {
      if (!this.verifySignature(headers, rawBody)) {
        return { status: 401, response: { error: 'Invalid signature' } };
      }
    }

    var body;
    try {
      body = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString());
    } catch (_) {
      return { status: 400, response: { error: 'Invalid JSON body' } };
    }

    var event = this.parseEvent(body);
    if (!event) {
      return { status: 200, response: { ignored: true, reason: 'Unsupported event' } };
    }

    // Filter by issue type
    var issueType = event.issue && event.issue.fields && event.issue.fields.issuetype
      ? event.issue.fields.issuetype.name
      : null;
    if (issueType && this._issueTypes.indexOf(issueType) === -1) {
      return { status: 200, response: { ignored: true, reason: 'Irrelevant issue type: ' + issueType } };
    }

    // Dispatch to callbacks
    if (event.eventType === 'jira:issue_created' && issueType === 'Epic' && this._onEpicCreated) {
      this._onEpicCreated(event.issue);
    } else if (event.eventType === 'jira:issue_updated' && this._onIssueUpdated) {
      this._onIssueUpdated(event.issue, event.changelog);
    }

    return { status: 200, response: { processed: true, eventType: event.eventType } };
  }

  /**
   * Verify HMAC-SHA256 signature.
   */
  verifySignature(headers, rawBody) {
    if (!this._secret) return true;
    var signature = headers['x-hub-signature'] || headers['X-Hub-Signature'] || '';
    if (!signature) return false;
    var bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString();
    var expected = 'sha256=' + crypto.createHmac('sha256', this._secret).update(bodyStr).digest('hex');
    var sigBuf = Buffer.from(signature); var expBuf = Buffer.from(expected); if (sigBuf.length !== expBuf.length) return false; return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Parse a webhook event body.
   * @returns {{ eventType: string, issue: object, changelog: object }|null}
   */
  parseEvent(body) {
    if (!body || !body.webhookEvent) return null;
    if (SUPPORTED_EVENTS.indexOf(body.webhookEvent) === -1) return null;
    return {
      eventType: body.webhookEvent,
      issue: body.issue || null,
      changelog: body.changelog || null,
    };
  }
}

module.exports = { WebhookHandler, SUPPORTED_EVENTS };
