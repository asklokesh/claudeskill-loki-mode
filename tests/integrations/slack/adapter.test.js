'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var { SlackAdapter } = require('../../../src/integrations/slack/adapter');
var { IntegrationAdapter } = require('../../../src/integrations/adapter');
var blocks = require('../../../src/integrations/slack/blocks');
var commands = require('../../../src/integrations/slack/commands');
var webhookHandler = require('../../../src/integrations/slack/webhook-handler');
var crypto = require('crypto');
var { EventEmitter } = require('events');

// -- Signing helper --
var TEST_SIGNING_SECRET = 'test-signing-secret-for-adapter';

function makeSignedHeaders(body, secret) {
    secret = secret || TEST_SIGNING_SECRET;
    var timestamp = String(Math.floor(Date.now() / 1000));
    var sigBasestring = 'v0:' + timestamp + ':' + body;
    var signature = 'v0=' + crypto.createHmac('sha256', secret)
        .update(sigBasestring)
        .digest('hex');
    return {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': signature
    };
}

// -- Mock Slack WebClient --
function makeMockClient() {
    var calls = [];
    return {
        calls: calls,
        chat: {
            postMessage: function(opts) {
                calls.push({ method: 'chat.postMessage', opts: opts });
                return Promise.resolve({ ok: true });
            }
        },
        conversations: {
            history: function(opts) {
                calls.push({ method: 'conversations.history', opts: opts });
                return Promise.resolve({
                    messages: [
                        { text: 'First message' },
                        { text: 'Second message' }
                    ]
                });
            }
        }
    };
}

// -- SlackAdapter Tests --

test('SlackAdapter extends IntegrationAdapter', function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test' });
    assert.ok(adapter instanceof IntegrationAdapter);
    assert.ok(adapter instanceof EventEmitter);
    assert.equal(adapter.name, 'slack');
});

test('SlackAdapter constructor sets token, channel, signingSecret from options', function() {
    var adapter = new SlackAdapter({
        token: 'xoxb-abc',
        channel: 'C12345',
        signingSecret: 'secret123'
    });
    assert.equal(adapter._token, 'xoxb-abc');
    assert.equal(adapter._channel, 'C12345');
    assert.equal(adapter._signingSecret, 'secret123');
});

test('SlackAdapter constructor falls back to env vars', function() {
    var origToken = process.env.LOKI_SLACK_BOT_TOKEN;
    var origChannel = process.env.LOKI_SLACK_CHANNEL;
    var origSecret = process.env.LOKI_SLACK_SIGNING_SECRET;

    process.env.LOKI_SLACK_BOT_TOKEN = 'env-token';
    process.env.LOKI_SLACK_CHANNEL = 'env-channel';
    process.env.LOKI_SLACK_SIGNING_SECRET = 'env-secret';

    try {
        var adapter = new SlackAdapter({});
        assert.equal(adapter._token, 'env-token');
        assert.equal(adapter._channel, 'env-channel');
        assert.equal(adapter._signingSecret, 'env-secret');
    } finally {
        // Restore env
        if (origToken === undefined) delete process.env.LOKI_SLACK_BOT_TOKEN;
        else process.env.LOKI_SLACK_BOT_TOKEN = origToken;
        if (origChannel === undefined) delete process.env.LOKI_SLACK_CHANNEL;
        else process.env.LOKI_SLACK_CHANNEL = origChannel;
        if (origSecret === undefined) delete process.env.LOKI_SLACK_SIGNING_SECRET;
        else process.env.LOKI_SLACK_SIGNING_SECRET = origSecret;
    }
});

test('SlackAdapter constructor defaults to empty strings', function() {
    var origToken = process.env.LOKI_SLACK_BOT_TOKEN;
    var origChannel = process.env.LOKI_SLACK_CHANNEL;
    var origSecret = process.env.LOKI_SLACK_SIGNING_SECRET;

    delete process.env.LOKI_SLACK_BOT_TOKEN;
    delete process.env.LOKI_SLACK_CHANNEL;
    delete process.env.LOKI_SLACK_SIGNING_SECRET;

    try {
        var adapter = new SlackAdapter({});
        assert.equal(adapter._token, '');
        assert.equal(adapter._channel, '');
        assert.equal(adapter._signingSecret, '');
    } finally {
        if (origToken !== undefined) process.env.LOKI_SLACK_BOT_TOKEN = origToken;
        if (origChannel !== undefined) process.env.LOKI_SLACK_CHANNEL = origChannel;
        if (origSecret !== undefined) process.env.LOKI_SLACK_SIGNING_SECRET = origSecret;
    }
});

test('SlackAdapter _getClient throws when @slack/web-api not installed', function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test' });
    // _client is null, so it will try to require @slack/web-api which is not installed
    assert.throws(function() { adapter._getClient(); }, {
        message: /Slack integration requires @slack\/web-api/
    });
});

test('SlackAdapter _getClient returns cached client', function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test' });
    var mockClient = makeMockClient();
    adapter._client = mockClient;
    assert.equal(adapter._getClient(), mockClient);
});

test('SlackAdapter syncStatus builds Block Kit message and calls postMessage', async function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test', channel: 'C12345', baseDelay: 1 });
    var mockClient = makeMockClient();
    adapter._client = mockClient;

    await adapter.syncStatus('proj-1', 'building', { iteration: 3, provider: 'claude' });

    assert.equal(mockClient.calls.length, 1);
    var call = mockClient.calls[0];
    assert.equal(call.method, 'chat.postMessage');
    assert.equal(call.opts.channel, 'C12345');
    assert.equal(call.opts.text, 'Loki Mode: building');
    assert.ok(Array.isArray(call.opts.blocks));
    // Should have header, status section, details section, divider
    assert.ok(call.opts.blocks.length >= 3);
});

test('SlackAdapter importProject reads channel history', async function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test', baseDelay: 1 });
    var mockClient = makeMockClient();
    adapter._client = mockClient;

    var result = await adapter.importProject('C99999');

    assert.equal(mockClient.calls.length, 1);
    assert.equal(mockClient.calls[0].method, 'conversations.history');
    assert.equal(mockClient.calls[0].opts.channel, 'C99999');
    assert.equal(result.title, 'Slack Import: C99999');
    assert.equal(result.source, 'slack');
    assert.ok(result.content.includes('First message'));
    assert.ok(result.content.includes('Second message'));
});

test('SlackAdapter postComment calls postMessage with text content', async function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test', baseDelay: 1 });
    var mockClient = makeMockClient();
    adapter._client = mockClient;

    await adapter.postComment('C12345', 'Quality report looks good');

    assert.equal(mockClient.calls.length, 1);
    var call = mockClient.calls[0];
    assert.equal(call.method, 'chat.postMessage');
    assert.equal(call.opts.channel, 'C12345');
    assert.equal(call.opts.text, 'Quality report looks good');
});

test('SlackAdapter createSubtasks formats task list and posts', async function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test', baseDelay: 1 });
    var mockClient = makeMockClient();
    adapter._client = mockClient;

    var tasks = [
        { title: 'Setup database' },
        { title: 'Build API' },
        { title: 'Write tests' }
    ];
    var result = await adapter.createSubtasks('C12345', tasks);

    assert.equal(mockClient.calls.length, 1);
    var call = mockClient.calls[0];
    assert.equal(call.method, 'chat.postMessage');
    assert.ok(call.opts.text.includes('*Task Breakdown:*'));
    assert.ok(call.opts.text.includes('1. Setup database'));
    assert.ok(call.opts.text.includes('2. Build API'));
    assert.ok(call.opts.text.includes('3. Write tests'));

    assert.equal(result.length, 3);
    assert.equal(result[0].id, 'Setup database');
    assert.equal(result[0].status, 'posted');
});

test('SlackAdapter getWebhookHandler returns a function', function() {
    var adapter = new SlackAdapter({ token: 'xoxb-test' });
    var handler = adapter.getWebhookHandler();
    assert.equal(typeof handler, 'function');
});

test('SlackAdapter webhook handler responds to url_verification challenge', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    var payload = JSON.stringify({ type: 'url_verification', challenge: 'test-challenge-123' });
    var req = new EventEmitter();
    req.headers = makeSignedHeaders(payload);

    var responseHeaders = {};
    var responseBody = '';
    var res = {
        writeHead: function(code, headers) {
            responseHeaders.code = code;
            responseHeaders.headers = headers;
        },
        end: function(body) {
            responseBody = body;
            assert.equal(responseHeaders.code, 200);
            assert.equal(responseBody, 'test-challenge-123');
            done();
        }
    };

    handler(req, res);
    req.emit('data', payload);
    req.emit('end');
});

test('SlackAdapter webhook handler emits interaction for block_actions', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    var payload = JSON.stringify({ type: 'block_actions', actions: [{ action_id: 'approve_deploy' }] });
    var req = new EventEmitter();
    req.headers = makeSignedHeaders(payload);

    adapter.on('interaction', function(p) {
        assert.equal(p.type, 'block_actions');
        done();
    });

    var res = {
        writeHead: function() {},
        end: function() {}
    };

    handler(req, res);
    req.emit('data', payload);
    req.emit('end');
});

test('SlackAdapter webhook handler emits event for event_callback', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    var payload = JSON.stringify({ type: 'event_callback', event: { type: 'message', text: 'hello' } });
    var req = new EventEmitter();
    req.headers = makeSignedHeaders(payload);

    adapter.on('event', function(ev) {
        assert.equal(ev.type, 'message');
        assert.equal(ev.text, 'hello');
        done();
    });

    var res = {
        writeHead: function() {},
        end: function() {}
    };

    handler(req, res);
    req.emit('data', payload);
    req.emit('end');
});

test('SlackAdapter webhook handler rejects unauthorized requests (missing timestamp)', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: 'my-secret' });
    var handler = adapter.getWebhookHandler();

    var payload = JSON.stringify({ type: 'event_callback' });
    var req = new EventEmitter();
    req.headers = {}; // No x-slack-request-timestamp or x-slack-signature

    var statusCode = null;
    var res = {
        writeHead: function(code) { statusCode = code; },
        end: function(body) {
            assert.equal(statusCode, 401);
            assert.equal(body, 'Unauthorized');
            done();
        }
    };

    handler(req, res);
    req.emit('data', payload);
    req.emit('end');
});

test('SlackAdapter webhook handler returns 400 on invalid JSON', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    var badBody = 'not-valid-json{{{';
    var req = new EventEmitter();
    req.headers = makeSignedHeaders(badBody);

    var statusCode = null;
    var res = {
        writeHead: function(code) { statusCode = code; },
        end: function(body) {
            assert.equal(statusCode, 400);
            assert.equal(body, 'Bad Request');
            done();
        }
    };

    handler(req, res);
    req.emit('data', badBody);
    req.emit('end');
});

// -- Signature verification and body size limit tests --

test('SlackAdapter webhook rejects request when no signing secret is configured (fail-closed)', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: '' });
    var handler = adapter.getWebhookHandler();

    var req = new EventEmitter();
    req.headers = {};

    var statusCode = null;
    var res = {
        writeHead: function(code) { statusCode = code; },
        end: function(body) {
            assert.equal(statusCode, 401);
            assert.equal(body, 'Unauthorized');
            done();
        }
    };

    handler(req, res);
});

test('SlackAdapter webhook rejects request with invalid signature', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    var payload = JSON.stringify({ type: 'event_callback', event: { type: 'message' } });
    var req = new EventEmitter();
    req.headers = {
        'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-slack-signature': 'v0=invalidsignaturevalue'
    };

    var statusCode = null;
    var res = {
        writeHead: function(code) { statusCode = code; },
        end: function(body) {
            assert.equal(statusCode, 401);
            assert.equal(body, 'Unauthorized');
            done();
        }
    };

    handler(req, res);
    req.emit('data', payload);
    req.emit('end');
});

test('SlackAdapter webhook rejects request with missing signature headers', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    var payload = JSON.stringify({ type: 'event_callback' });
    var req = new EventEmitter();
    req.headers = {}; // No signature headers

    var statusCode = null;
    var res = {
        writeHead: function(code) { statusCode = code; },
        end: function(body) {
            assert.equal(statusCode, 401);
            assert.equal(body, 'Unauthorized');
            done();
        }
    };

    handler(req, res);
    req.emit('data', payload);
    req.emit('end');
});

test('SlackAdapter webhook calls verifySlackSignature with correct parameters', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    // Capture the call to _verifySignature
    var capturedArgs = null;
    var origVerify = adapter._verifySignature.bind(adapter);
    adapter._verifySignature = function(secret, ts, body, sig) {
        capturedArgs = { secret: secret, timestamp: ts, body: body, signature: sig };
        return origVerify(secret, ts, body, sig);
    };

    var payload = JSON.stringify({ type: 'event_callback', event: { type: 'message' } });
    var headers = makeSignedHeaders(payload);
    var req = new EventEmitter();
    req.headers = headers;

    var res = {
        writeHead: function() {},
        end: function() {
            assert.ok(capturedArgs !== null, '_verifySignature was called');
            assert.equal(capturedArgs.secret, TEST_SIGNING_SECRET);
            assert.equal(capturedArgs.timestamp, headers['x-slack-request-timestamp']);
            assert.equal(capturedArgs.body, payload);
            assert.equal(capturedArgs.signature, headers['x-slack-signature']);
            done();
        }
    };

    handler(req, res);
    req.emit('data', payload);
    req.emit('end');
});

test('SlackAdapter webhook returns 413 when body exceeds 1MB', function(t, done) {
    var adapter = new SlackAdapter({ signingSecret: TEST_SIGNING_SECRET });
    var handler = adapter.getWebhookHandler();

    var req = new EventEmitter();
    req.headers = { 'x-slack-request-timestamp': '12345', 'x-slack-signature': 'v0=abc' };
    req.destroy = function() {}; // Mock destroy

    var statusCode = null;
    var res = {
        writeHead: function(code) { statusCode = code; },
        end: function(body) {
            assert.equal(statusCode, 413);
            assert.equal(body, 'Payload Too Large');
            done();
        }
    };

    handler(req, res);
    // Send a chunk larger than 1MB
    var largeChunk = Buffer.alloc(1024 * 1024 + 1, 'x').toString();
    req.emit('data', largeChunk);
});

// -- blocks.js Tests --

test('blocks.buildStatusBlocks returns valid block array with header, fields, divider', function() {
    var result = blocks.buildStatusBlocks('proj-1', 'building');
    assert.ok(Array.isArray(result));
    assert.equal(result[0].type, 'header');
    assert.equal(result[0].text.text, 'Loki Mode Status Update');
    assert.equal(result[1].type, 'section');
    assert.ok(result[1].fields[0].text.includes('proj-1'));
    assert.ok(result[1].fields[1].text.includes('BUILDING'));
    // Last block should be divider
    assert.equal(result[result.length - 1].type, 'divider');
});

test('blocks.buildStatusBlocks includes detail fields when provided', function() {
    var result = blocks.buildStatusBlocks('proj-2', 'testing', {
        iteration: 5,
        provider: 'claude',
        phase: 'VERIFY'
    });
    // Should have header, status section, detail section, divider = 4 blocks
    assert.equal(result.length, 4);
    var detailSection = result[2];
    assert.equal(detailSection.type, 'section');
    assert.equal(detailSection.fields.length, 3);
    assert.ok(detailSection.fields[0].text.includes('5'));
    assert.ok(detailSection.fields[1].text.includes('claude'));
    assert.ok(detailSection.fields[2].text.includes('VERIFY'));
});

test('blocks.buildStatusBlocks handles null/undefined projectId and status', function() {
    var result = blocks.buildStatusBlocks(null, null);
    assert.ok(result[1].fields[0].text.includes('Unknown'));
});

test('blocks.buildApprovalBlocks includes approve and reject buttons', function() {
    var result = blocks.buildApprovalBlocks('proj-1', 'Deploy to production?', 'deploy');
    assert.ok(Array.isArray(result));
    assert.equal(result[0].type, 'header');
    assert.equal(result[0].text.text, 'Approval Required');
    assert.equal(result[1].type, 'section');
    assert.ok(result[1].text.text.includes('Deploy to production?'));

    var actions = result[2];
    assert.equal(actions.type, 'actions');
    assert.equal(actions.elements.length, 2);
    assert.equal(actions.elements[0].text.text, 'Approve');
    assert.equal(actions.elements[0].style, 'primary');
    assert.equal(actions.elements[0].action_id, 'approve_deploy');
    assert.equal(actions.elements[1].text.text, 'Reject');
    assert.equal(actions.elements[1].style, 'danger');
    assert.equal(actions.elements[1].action_id, 'reject_deploy');

    // Values should contain projectId
    var approveValue = JSON.parse(actions.elements[0].value);
    assert.equal(approveValue.projectId, 'proj-1');
    assert.equal(approveValue.action, 'approve');
});

test('blocks.buildErrorBlocks returns header and error section', function() {
    var result = blocks.buildErrorBlocks('proj-1', 'Build failed');
    assert.equal(result.length, 2);
    assert.equal(result[0].type, 'header');
    assert.equal(result[0].text.text, 'Loki Mode Error');
    assert.ok(result[1].text.text.includes('proj-1'));
    assert.ok(result[1].text.text.includes('Build failed'));
});

// -- commands.js Tests --

test('commands.routeCommand routes /loki-status', function() {
    var result = commands.routeCommand('/loki-status', { status: 'building', iteration: 3 });
    assert.equal(result.response_type, 'in_channel');
    assert.equal(result.text, 'Loki Mode Status');
    assert.ok(Array.isArray(result.blocks));
});

test('commands.routeCommand routes /loki-approve', function() {
    var result = commands.routeCommand('/loki-approve', { userId: 'U123' });
    assert.equal(result.response_type, 'in_channel');
    assert.ok(result.text.includes('U123'));
    assert.ok(result.text.includes('approved'));
});

test('commands.routeCommand routes /loki-stop', function() {
    var result = commands.routeCommand('/loki-stop', { userId: 'U456' });
    assert.equal(result.response_type, 'in_channel');
    assert.ok(result.text.includes('U456'));
    assert.ok(result.text.includes('Stop requested'));
});

test('commands.routeCommand returns error for unknown commands', function() {
    var result = commands.routeCommand('/loki-unknown', {});
    assert.equal(result.response_type, 'ephemeral');
    assert.ok(result.text.includes('Unknown command'));
    assert.ok(result.text.includes('/loki-unknown'));
});

test('commands.COMMAND_HANDLERS has expected keys', function() {
    assert.ok('/loki-status' in commands.COMMAND_HANDLERS);
    assert.ok('/loki-approve' in commands.COMMAND_HANDLERS);
    assert.ok('/loki-stop' in commands.COMMAND_HANDLERS);
});

// -- webhook-handler.js Tests --

test('webhook-handler verifySlackSignature validates HMAC correctly', function() {
    var secret = 'test-signing-secret';
    var timestamp = String(Math.floor(Date.now() / 1000));
    var body = '{"type":"event_callback","event":{"type":"message"}}';
    var sigBasestring = 'v0:' + timestamp + ':' + body;
    var signature = 'v0=' + crypto.createHmac('sha256', secret)
        .update(sigBasestring)
        .digest('hex');

    assert.equal(webhookHandler.verifySlackSignature(secret, timestamp, body, signature), true);
});

test('webhook-handler verifySlackSignature rejects invalid signature', function() {
    var secret = 'test-signing-secret';
    var timestamp = String(Math.floor(Date.now() / 1000));
    var body = '{"type":"event_callback"}';
    assert.equal(webhookHandler.verifySlackSignature(secret, timestamp, body, 'v0=invalid'), false);
});

test('webhook-handler verifySlackSignature rejects missing params', function() {
    assert.equal(webhookHandler.verifySlackSignature('', 'ts', 'body', 'sig'), false);
    assert.equal(webhookHandler.verifySlackSignature('secret', '', 'body', 'sig'), false);
    assert.equal(webhookHandler.verifySlackSignature('secret', 'ts', 'body', ''), false);
});

test('webhook-handler verifySlackSignature rejects old timestamps', function() {
    var secret = 'test-signing-secret';
    var oldTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
    var body = 'test';
    var sigBasestring = 'v0:' + oldTimestamp + ':' + body;
    var signature = 'v0=' + crypto.createHmac('sha256', secret)
        .update(sigBasestring)
        .digest('hex');

    assert.equal(webhookHandler.verifySlackSignature(secret, oldTimestamp, body, signature), false);
});

test('webhook-handler parseSlackPayload parses JSON', function() {
    var result = webhookHandler.parseSlackPayload('{"type":"event_callback"}');
    assert.deepEqual(result, { type: 'event_callback' });
});

test('webhook-handler parseSlackPayload parses URL-encoded payload', function() {
    var payload = { type: 'block_actions', actions: [] };
    var encoded = 'payload=' + encodeURIComponent(JSON.stringify(payload));
    var result = webhookHandler.parseSlackPayload(encoded);
    assert.deepEqual(result, payload);
});

test('webhook-handler parseSlackPayload returns null for invalid input', function() {
    assert.equal(webhookHandler.parseSlackPayload('not-json'), null);
    assert.equal(webhookHandler.parseSlackPayload('payload=not-json'), null);
});
