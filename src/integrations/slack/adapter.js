'use strict';

var IntegrationAdapter = require('../adapter').IntegrationAdapter;
var blocks = require('./blocks');
var { verifySlackSignature } = require('./webhook-handler');

class SlackAdapter extends IntegrationAdapter {
    constructor(options) {
        super('slack', options);
        this._token = (options && options.token) || process.env.LOKI_SLACK_BOT_TOKEN || '';
        this._channel = (options && options.channel) || process.env.LOKI_SLACK_CHANNEL || '';
        this._signingSecret = (options && options.signingSecret) || process.env.LOKI_SLACK_SIGNING_SECRET || '';
        this._client = null;
    }

    _getClient() {
        if (this._client) return this._client;
        try {
            var WebClient = require('@slack/web-api').WebClient;
            this._client = new WebClient(this._token);
            return this._client;
        } catch (e) {
            throw new Error(
                'Slack integration requires @slack/web-api. ' +
                'Install it with: npm install @slack/web-api'
            );
        }
    }

    async importProject(externalId) {
        // Read thread messages from a Slack channel/thread as PRD input
        return this.withRetry('importProject', async () => {
            var client = this._getClient();
            var result = await client.conversations.history({
                channel: externalId,
                limit: 50
            });
            var messages = (result.messages || []).map(m => m.text).join('\n\n');
            return { title: 'Slack Import: ' + externalId, content: messages, source: 'slack' };
        });
    }

    async syncStatus(projectId, status, details) {
        return this.withRetry('syncStatus', async () => {
            var client = this._getClient();
            var statusBlocks = blocks.buildStatusBlocks(projectId, status, details);
            await client.chat.postMessage({
                channel: this._channel,
                blocks: statusBlocks,
                text: 'Loki Mode: ' + status  // Fallback for notifications
            });
        });
    }

    async postComment(externalId, content) {
        return this.withRetry('postComment', async () => {
            var client = this._getClient();
            await client.chat.postMessage({
                channel: externalId,
                text: content
            });
        });
    }

    async createSubtasks(externalId, tasks) {
        // Slack doesn't have subtasks - post as a formatted list instead
        return this.withRetry('createSubtasks', async () => {
            var client = this._getClient();
            var taskList = tasks.map((t, i) => (i + 1) + '. ' + t.title).join('\n');
            await client.chat.postMessage({
                channel: externalId,
                text: '*Task Breakdown:*\n' + taskList
            });
            return tasks.map(t => ({ id: t.title, status: 'posted' }));
        });
    }

    getWebhookHandler() {
        var self = this;
        var MAX_BODY_SIZE = 1024 * 1024; // 1MB
        return function(req, res) {
            // Fail-closed: reject if no signing secret is configured
            if (!self._signingSecret) {
                res.writeHead(401);
                res.end('Unauthorized');
                return;
            }
            // Collect raw body first, then verify signature
            var body = '';
            var bodySize = 0;
            req.on('data', function(chunk) {
                bodySize += Buffer.byteLength(chunk);
                if (bodySize > MAX_BODY_SIZE) {
                    res.writeHead(413);
                    res.end('Payload Too Large');
                    req.destroy();
                    return;
                }
                body += chunk;
            });
            req.on('end', function() {
                if (bodySize > MAX_BODY_SIZE) return; // Already responded with 413
                // Verify request signature using raw body
                var timestamp = req.headers['x-slack-request-timestamp'] || '';
                var signature = req.headers['x-slack-signature'] || '';
                if (!self._verifySignature(self._signingSecret, timestamp, body, signature)) {
                    res.writeHead(401);
                    res.end('Unauthorized');
                    return;
                }
                try {
                    var payload = JSON.parse(body);
                    // Handle URL verification challenge
                    if (payload.type === 'url_verification') {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end(payload.challenge);
                        return;
                    }
                    // Handle interactive messages (approval buttons)
                    if (payload.type === 'interactive_message' || payload.type === 'block_actions') {
                        self.emit('interaction', payload);
                    }
                    // Handle events
                    if (payload.type === 'event_callback') {
                        self.emit('event', payload.event);
                    }
                    res.writeHead(200);
                    res.end('ok');
                } catch (e) {
                    res.writeHead(400);
                    res.end('Bad Request');
                }
            });
        };
    }

    _verifySignature(signingSecret, timestamp, body, signature) {
        return verifySlackSignature(signingSecret, timestamp, body, signature);
    }
}

module.exports = { SlackAdapter };
