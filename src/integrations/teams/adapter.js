'use strict';
var IntegrationAdapter = require('../adapter').IntegrationAdapter;
var cards = require('./cards');
var crypto = require('crypto');
var https = require('https');
var http = require('http');
var url = require('url');

var MAX_BODY_SIZE = 1024 * 1024; // 1MB

class TeamsAdapter extends IntegrationAdapter {
    constructor(options) {
        super('teams', options);
        this._webhookUrl = (options && options.webhookUrl) || process.env.LOKI_TEAMS_WEBHOOK_URL || '';
        this._callbackUrl = (options && options.callbackUrl) || process.env.LOKI_TEAMS_CALLBACK_URL || '';
        this._webhookSecret = (options && options.webhookSecret) || process.env.LOKI_TEAMS_WEBHOOK_SECRET || '';
    }

    async importProject(externalId) {
        // Teams doesn't support importing from channels easily
        return { title: 'Teams Import: ' + externalId, content: '', source: 'teams' };
    }

    async syncStatus(projectId, status, details) {
        return this.withRetry('syncStatus', async () => {
            var card = cards.buildStatusCard(projectId, status, details);
            await this._postWebhook(card);
        });
    }

    async postComment(externalId, content) {
        return this.withRetry('postComment', async () => {
            var card = cards.buildMessageCard(content);
            await this._postWebhook(card);
        });
    }

    async createSubtasks(externalId, tasks) {
        return this.withRetry('createSubtasks', async () => {
            var card = cards.buildTaskListCard(tasks);
            await this._postWebhook(card);
            return tasks.map(function(t) { return { id: t.title, status: 'posted' }; });
        });
    }

    getWebhookHandler() {
        var self = this;
        return function(req, res) {
            var bodySize = 0;
            var chunks = [];
            req.on('data', function(chunk) {
                bodySize += chunk.length;
                if (bodySize > MAX_BODY_SIZE) {
                    req.destroy();
                    res.writeHead(413);
                    res.end('Payload Too Large');
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', function() {
                if (bodySize > MAX_BODY_SIZE) return;
                var body = Buffer.concat(chunks).toString();

                // Fail-closed: reject all requests if no webhook secret is configured
                if (!self._webhookSecret) {
                    res.writeHead(401);
                    res.end('Unauthorized');
                    return;
                }

                // Verify HMAC-SHA256 signature
                var signature = req.headers && req.headers['x-loki-signature'];
                if (!signature) {
                    res.writeHead(401);
                    res.end('Unauthorized');
                    return;
                }

                var expected = crypto
                    .createHmac('sha256', self._webhookSecret)
                    .update(body)
                    .digest('hex');

                var sigBuf = Buffer.from(signature, 'utf8');
                var expBuf = Buffer.from(expected, 'utf8');
                if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
                    res.writeHead(401);
                    res.end('Unauthorized');
                    return;
                }

                try {
                    var payload = JSON.parse(body);
                    // Handle action callbacks (approval buttons)
                    if (payload.type === 'invoke' || payload.value) {
                        self.emit('interaction', payload);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 200, body: 'Action received' }));
                        return;
                    }
                    self.emit('event', payload);
                    res.writeHead(200);
                    res.end('ok');
                } catch (e) {
                    res.writeHead(400);
                    res.end('Bad Request');
                }
            });
        };
    }

    _postWebhook(card) {
        if (!this._webhookUrl) {
            return Promise.reject(new Error('LOKI_TEAMS_WEBHOOK_URL is not configured'));
        }
        var parsed = url.parse(this._webhookUrl);
        var transport = parsed.protocol === 'https:' ? https : http;
        var payload = JSON.stringify(card);

        return new Promise(function(resolve, reject) {
            var req = transport.request({
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
                timeout: 30000,
            }, function(res) {
                var data = '';
                res.on('data', function(chunk) { data += chunk; });
                res.on('end', function() {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error('Teams webhook failed: ' + res.statusCode + ' ' + data));
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', function() {
                req.destroy();
                reject(new Error('Teams webhook timeout'));
            });
            req.write(payload);
            req.end();
        });
    }
}

module.exports = { TeamsAdapter };
