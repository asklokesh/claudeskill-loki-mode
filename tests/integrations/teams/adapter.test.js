'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var http = require('http');
var crypto = require('crypto');
var { Readable } = require('stream');
var { TeamsAdapter } = require('../../../src/integrations/teams/adapter');
var cards = require('../../../src/integrations/teams/cards');
var webhook = require('../../../src/integrations/teams/webhook');
var { IntegrationAdapter } = require('../../../src/integrations/adapter');

// Helper: create a mock HTTP server that responds with given status/body
function startMockServer(handler) {
    return new Promise(function(resolve) {
        var server = http.createServer(handler);
        server.listen(0, '127.0.0.1', function() {
            resolve({ server: server, url: 'http://127.0.0.1:' + server.address().port });
        });
    });
}

// Helper: create a fake IncomingMessage from a string body
function fakeRequest(body) {
    var readable = new Readable();
    readable.push(body);
    readable.push(null);
    return readable;
}

// Helper: create a fake ServerResponse that captures output
function fakeResponse() {
    var res = {
        _status: null,
        _headers: {},
        _body: '',
        writeHead: function(status, headers) {
            res._status = status;
            if (headers) res._headers = headers;
        },
        end: function(body) {
            res._body = body || '';
        },
    };
    return res;
}

// Helper: compute HMAC-SHA256 hex signature for a body string
var TEST_WEBHOOK_SECRET = 'test-secret-key-for-hmac';

function signBody(body, secret) {
    secret = secret || TEST_WEBHOOK_SECRET;
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// Helper: create a fake request with headers support
function fakeRequestWithHeaders(body, headers) {
    var readable = new Readable();
    readable.push(body);
    readable.push(null);
    readable.headers = headers || {};
    return readable;
}

// -- TeamsAdapter class tests --

test('TeamsAdapter extends IntegrationAdapter', function() {
    var adapter = new TeamsAdapter();
    assert.ok(adapter instanceof IntegrationAdapter);
    assert.equal(adapter.name, 'teams');
});

test('TeamsAdapter constructor reads options', function() {
    var adapter = new TeamsAdapter({
        webhookUrl: 'https://webhook.example.com/abc',
        callbackUrl: 'https://callback.example.com/hook',
    });
    assert.equal(adapter._webhookUrl, 'https://webhook.example.com/abc');
    assert.equal(adapter._callbackUrl, 'https://callback.example.com/hook');
});

test('TeamsAdapter constructor reads env vars as fallback', function() {
    var origWebhook = process.env.LOKI_TEAMS_WEBHOOK_URL;
    var origCallback = process.env.LOKI_TEAMS_CALLBACK_URL;
    process.env.LOKI_TEAMS_WEBHOOK_URL = 'https://env-webhook.example.com';
    process.env.LOKI_TEAMS_CALLBACK_URL = 'https://env-callback.example.com';
    try {
        var adapter = new TeamsAdapter();
        assert.equal(adapter._webhookUrl, 'https://env-webhook.example.com');
        assert.equal(adapter._callbackUrl, 'https://env-callback.example.com');
    } finally {
        if (origWebhook === undefined) delete process.env.LOKI_TEAMS_WEBHOOK_URL;
        else process.env.LOKI_TEAMS_WEBHOOK_URL = origWebhook;
        if (origCallback === undefined) delete process.env.LOKI_TEAMS_CALLBACK_URL;
        else process.env.LOKI_TEAMS_CALLBACK_URL = origCallback;
    }
});

test('TeamsAdapter constructor defaults to empty strings', function() {
    var orig = process.env.LOKI_TEAMS_WEBHOOK_URL;
    delete process.env.LOKI_TEAMS_WEBHOOK_URL;
    try {
        var adapter = new TeamsAdapter();
        assert.equal(adapter._webhookUrl, '');
    } finally {
        if (orig !== undefined) process.env.LOKI_TEAMS_WEBHOOK_URL = orig;
    }
});

test('TeamsAdapter has default retry options', function() {
    var adapter = new TeamsAdapter();
    assert.equal(adapter.maxRetries, 3);
    assert.equal(adapter.baseDelay, 1000);
});

// -- importProject --

test('importProject returns formatted object', async function() {
    var adapter = new TeamsAdapter();
    var result = await adapter.importProject('channel-123');
    assert.equal(result.title, 'Teams Import: channel-123');
    assert.equal(result.content, '');
    assert.equal(result.source, 'teams');
});

// -- syncStatus with mock server --

test('syncStatus builds Adaptive Card and posts to webhook', async function() {
    var received = null;
    var mock = await startMockServer(function(req, res) {
        var body = '';
        req.on('data', function(c) { body += c; });
        req.on('end', function() {
            received = JSON.parse(body);
            res.writeHead(200);
            res.end('ok');
        });
    });

    try {
        var adapter = new TeamsAdapter({ webhookUrl: mock.url, maxRetries: 0 });
        await adapter.syncStatus('proj-1', 'building', { iteration: 3, provider: 'claude' });
        assert.ok(received);
        assert.equal(received.type, 'message');
        assert.equal(received.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
        var content = received.attachments[0].content;
        assert.equal(content.type, 'AdaptiveCard');
        // Check facts include project and status
        var facts = content.body[1].facts;
        assert.equal(facts[0].value, 'proj-1');
        assert.equal(facts[1].value, 'BUILDING');
    } finally {
        mock.server.close();
    }
});

// -- postComment with mock server --

test('postComment builds message card and posts', async function() {
    var received = null;
    var mock = await startMockServer(function(req, res) {
        var body = '';
        req.on('data', function(c) { body += c; });
        req.on('end', function() {
            received = JSON.parse(body);
            res.writeHead(200);
            res.end('ok');
        });
    });

    try {
        var adapter = new TeamsAdapter({ webhookUrl: mock.url, maxRetries: 0 });
        await adapter.postComment('ext-1', 'Quality report: all gates passed');
        assert.ok(received);
        var text = received.attachments[0].content.body[0].text;
        assert.equal(text, 'Quality report: all gates passed');
    } finally {
        mock.server.close();
    }
});

// -- createSubtasks with mock server --

test('createSubtasks builds task list card and returns results', async function() {
    var received = null;
    var mock = await startMockServer(function(req, res) {
        var body = '';
        req.on('data', function(c) { body += c; });
        req.on('end', function() {
            received = JSON.parse(body);
            res.writeHead(200);
            res.end('ok');
        });
    });

    try {
        var tasks = [{ title: 'Setup DB' }, { title: 'Build API' }, { title: 'Write tests' }];
        var adapter = new TeamsAdapter({ webhookUrl: mock.url, maxRetries: 0 });
        var result = await adapter.createSubtasks('ext-1', tasks);
        assert.equal(result.length, 3);
        assert.equal(result[0].id, 'Setup DB');
        assert.equal(result[0].status, 'posted');
        assert.equal(result[2].id, 'Write tests');
        // Verify card was sent
        assert.ok(received);
        var cardBody = received.attachments[0].content.body;
        assert.equal(cardBody[0].text, 'Task Breakdown');
    } finally {
        mock.server.close();
    }
});

// -- getWebhookHandler --

test('getWebhookHandler returns a function', function() {
    var adapter = new TeamsAdapter();
    var handler = adapter.getWebhookHandler();
    assert.equal(typeof handler, 'function');
});

test('webhook handler processes interaction payloads', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();
    var interactionPayload = null;

    adapter.on('interaction', function(p) { interactionPayload = p; });

    var bodyStr = JSON.stringify({ type: 'invoke', value: { action: 'approve' } });
    var req = fakeRequestWithHeaders(bodyStr, {
        'x-loki-signature': signBody(bodyStr),
    });
    var res = fakeResponse();

    // Simulate the end event completing
    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 200);
        assert.ok(interactionPayload);
        assert.equal(interactionPayload.type, 'invoke');
        var parsed = JSON.parse(res._body);
        assert.equal(parsed.status, 200);
        done();
    };

    handler(req, res);
});

test('webhook handler processes regular event payloads', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();
    var eventPayload = null;

    adapter.on('event', function(p) { eventPayload = p; });

    var bodyStr = JSON.stringify({ channel: 'general', message: 'hello' });
    var req = fakeRequestWithHeaders(bodyStr, {
        'x-loki-signature': signBody(bodyStr),
    });
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 200);
        assert.equal(res._body, 'ok');
        assert.ok(eventPayload);
        assert.equal(eventPayload.channel, 'general');
        done();
    };

    handler(req, res);
});

test('webhook handler emits interaction for payloads with value field', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();
    var interactionPayload = null;

    adapter.on('interaction', function(p) { interactionPayload = p; });

    var bodyStr = JSON.stringify({ value: { action: 'reject', projectId: 'p1' } });
    var req = fakeRequestWithHeaders(bodyStr, {
        'x-loki-signature': signBody(bodyStr),
    });
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 200);
        assert.ok(interactionPayload);
        assert.equal(interactionPayload.value.action, 'reject');
        done();
    };

    handler(req, res);
});

test('webhook handler rejects malformed JSON', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();

    var bodyStr = 'not valid json{{{';
    var req = fakeRequestWithHeaders(bodyStr, {
        'x-loki-signature': signBody(bodyStr),
    });
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 400);
        assert.equal(res._body, 'Bad Request');
        done();
    };

    handler(req, res);
});

// -- Webhook authentication tests --

test('webhook handler fails closed when no secret is configured', function(t, done) {
    var adapter = new TeamsAdapter(); // no webhookSecret
    var handler = adapter.getWebhookHandler();

    var bodyStr = JSON.stringify({ channel: 'general', message: 'hello' });
    var req = fakeRequestWithHeaders(bodyStr, {
        'x-loki-signature': 'anything',
    });
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 401);
        assert.equal(res._body, 'Unauthorized');
        done();
    };

    handler(req, res);
});

test('webhook handler rejects request with missing signature header', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();

    var bodyStr = JSON.stringify({ channel: 'general' });
    var req = fakeRequestWithHeaders(bodyStr, {}); // no x-loki-signature
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 401);
        assert.equal(res._body, 'Unauthorized');
        done();
    };

    handler(req, res);
});

test('webhook handler rejects request with invalid signature', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();

    var bodyStr = JSON.stringify({ channel: 'general' });
    var req = fakeRequestWithHeaders(bodyStr, {
        'x-loki-signature': 'deadbeef00112233445566778899aabbccddeeff00112233445566778899aabbcc',
    });
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 401);
        assert.equal(res._body, 'Unauthorized');
        done();
    };

    handler(req, res);
});

test('webhook handler rejects request signed with wrong secret', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();

    var bodyStr = JSON.stringify({ channel: 'general' });
    var req = fakeRequestWithHeaders(bodyStr, {
        'x-loki-signature': signBody(bodyStr, 'wrong-secret-key'),
    });
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 401);
        assert.equal(res._body, 'Unauthorized');
        done();
    };

    handler(req, res);
});

test('webhook handler returns 413 for oversized body', function(t, done) {
    var adapter = new TeamsAdapter({ webhookSecret: TEST_WEBHOOK_SECRET });
    var handler = adapter.getWebhookHandler();

    // Create a body larger than 1MB
    var oversizedBody = Buffer.alloc(1024 * 1024 + 1, 'x').toString();
    var req = new Readable({ read: function() {} });
    req.headers = { 'x-loki-signature': signBody(oversizedBody) };
    var res = fakeResponse();

    var origEnd = res.end;
    res.end = function(body) {
        origEnd.call(res, body);
        assert.equal(res._status, 413);
        assert.equal(res._body, 'Payload Too Large');
        done();
    };

    // Push in chunks to simulate streaming
    var chunkSize = 64 * 1024;
    for (var i = 0; i < oversizedBody.length; i += chunkSize) {
        req.push(oversizedBody.slice(i, i + chunkSize));
    }
    req.push(null);

    handler(req, res);
});

test('webhook handler reads secret from LOKI_TEAMS_WEBHOOK_SECRET env var', function(t, done) {
    var origSecret = process.env.LOKI_TEAMS_WEBHOOK_SECRET;
    process.env.LOKI_TEAMS_WEBHOOK_SECRET = 'env-secret';
    try {
        var adapter = new TeamsAdapter();
        var handler = adapter.getWebhookHandler();

        var bodyStr = JSON.stringify({ channel: 'general', message: 'from-env' });
        var req = fakeRequestWithHeaders(bodyStr, {
            'x-loki-signature': signBody(bodyStr, 'env-secret'),
        });
        var res = fakeResponse();

        var origEnd = res.end;
        res.end = function(body) {
            origEnd.call(res, body);
            assert.equal(res._status, 200);
            assert.equal(res._body, 'ok');
            done();
        };

        handler(req, res);
    } finally {
        if (origSecret === undefined) delete process.env.LOKI_TEAMS_WEBHOOK_SECRET;
        else process.env.LOKI_TEAMS_WEBHOOK_SECRET = origSecret;
    }
});

// -- _postWebhook --

test('_postWebhook rejects when no webhook URL configured', async function() {
    var adapter = new TeamsAdapter({ webhookUrl: '' });
    await assert.rejects(
        function() { return adapter._postWebhook({ type: 'message' }); },
        { message: /LOKI_TEAMS_WEBHOOK_URL is not configured/ }
    );
});

test('_postWebhook sends card to mock server', async function() {
    var received = null;
    var mock = await startMockServer(function(req, res) {
        var body = '';
        req.on('data', function(c) { body += c; });
        req.on('end', function() {
            received = JSON.parse(body);
            res.writeHead(200);
            res.end('accepted');
        });
    });

    try {
        var adapter = new TeamsAdapter({ webhookUrl: mock.url });
        var card = { type: 'message', text: 'test' };
        var result = await adapter._postWebhook(card);
        assert.equal(result, 'accepted');
        assert.deepEqual(received, card);
    } finally {
        mock.server.close();
    }
});

test('_postWebhook rejects on non-2xx response', async function() {
    var mock = await startMockServer(function(req, res) {
        var body = '';
        req.on('data', function(c) { body += c; });
        req.on('end', function() {
            res.writeHead(500);
            res.end('Internal Error');
        });
    });

    try {
        var adapter = new TeamsAdapter({ webhookUrl: mock.url });
        await assert.rejects(
            function() { return adapter._postWebhook({ type: 'message' }); },
            { message: /Teams webhook failed: 500/ }
        );
    } finally {
        mock.server.close();
    }
});

// -- cards module tests --

test('cards.buildStatusCard returns valid Adaptive Card structure', function() {
    var card = cards.buildStatusCard('proj-1', 'completed', { iteration: 5, provider: 'claude', phase: 'verify' });
    assert.equal(card.type, 'message');
    assert.equal(card.attachments.length, 1);
    assert.equal(card.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
    var content = card.attachments[0].content;
    assert.equal(content['$schema'], cards.SCHEMA);
    assert.equal(content.type, 'AdaptiveCard');
    assert.equal(content.version, cards.VERSION);
    // Header
    assert.equal(content.body[0].text, 'Loki Mode Status Update');
    // Facts
    var facts = content.body[1].facts;
    assert.equal(facts[0].title, 'Project');
    assert.equal(facts[0].value, 'proj-1');
    assert.equal(facts[1].title, 'Status');
    assert.equal(facts[1].value, 'COMPLETED');
    assert.equal(facts[2].title, 'Iteration');
    assert.equal(facts[2].value, '5');
    assert.equal(facts[3].title, 'Provider');
    assert.equal(facts[3].value, 'claude');
    assert.equal(facts[4].title, 'Phase');
    assert.equal(facts[4].value, 'verify');
});

test('cards.buildStatusCard handles missing details', function() {
    var card = cards.buildStatusCard(null, null);
    var facts = card.attachments[0].content.body[1].facts;
    assert.equal(facts[0].value, 'Unknown');
    assert.equal(facts[1].value, 'UNKNOWN');
    assert.equal(facts.length, 2);
});

test('cards.buildApprovalCard includes approve and reject actions', function() {
    var card = cards.buildApprovalCard('proj-2', 'Deploy to production?', 'https://cb.example.com');
    var content = card.attachments[0].content;
    assert.equal(content.body[0].text, 'Approval Required');
    assert.equal(content.body[1].text, 'Deploy to production?');
    assert.equal(content.actions.length, 2);
    assert.equal(content.actions[0].title, 'Approve');
    assert.equal(content.actions[0].style, 'positive');
    assert.equal(content.actions[0].data.action, 'approve');
    assert.equal(content.actions[0].data.projectId, 'proj-2');
    assert.equal(content.actions[1].title, 'Reject');
    assert.equal(content.actions[1].style, 'destructive');
    assert.equal(content.actions[1].data.action, 'reject');
});

test('cards.buildApprovalCard uses default description', function() {
    var card = cards.buildApprovalCard('proj-3', null);
    var content = card.attachments[0].content;
    assert.equal(content.body[1].text, 'Action requires approval');
});

test('cards.buildMessageCard wraps content in TextBlock', function() {
    var card = cards.buildMessageCard('Hello from Loki Mode');
    var content = card.attachments[0].content;
    assert.equal(content.body[0].text, 'Hello from Loki Mode');
    assert.equal(content.body[0].wrap, true);
});

test('cards.buildMessageCard handles empty content', function() {
    var card = cards.buildMessageCard('');
    assert.equal(card.attachments[0].content.body[0].text, '');
});

test('cards.buildTaskListCard lists tasks with numbers', function() {
    var tasks = [{ title: 'Design' }, { title: 'Implement' }, { title: 'Test' }];
    var card = cards.buildTaskListCard(tasks);
    var content = card.attachments[0].content;
    assert.equal(content.body[0].text, 'Task Breakdown');
    assert.equal(content.body[1].text, '1. Design');
    assert.equal(content.body[2].text, '2. Implement');
    assert.equal(content.body[3].text, '3. Test');
});

test('cards.buildTaskListCard handles empty tasks', function() {
    var card = cards.buildTaskListCard([]);
    var content = card.attachments[0].content;
    assert.equal(content.body.length, 1); // only header
});

test('cards.buildTaskListCard handles missing title', function() {
    var card = cards.buildTaskListCard([{}]);
    var content = card.attachments[0].content;
    assert.equal(content.body[1].text, '1. Untitled');
});

test('cards.buildErrorCard shows error details', function() {
    var card = cards.buildErrorCard('proj-1', 'Build failed: exit code 1');
    var content = card.attachments[0].content;
    assert.equal(content.body[0].text, 'Loki Mode Error');
    assert.equal(content.body[0].color, 'attention');
    var facts = content.body[1].facts;
    assert.equal(facts[0].value, 'proj-1');
    assert.equal(facts[1].value, 'Build failed: exit code 1');
});

test('cards.SCHEMA and VERSION are exported', function() {
    assert.equal(cards.SCHEMA, 'http://adaptivecards.io/schemas/adaptive-card.json');
    assert.equal(cards.VERSION, '1.4');
});

// -- webhook module tests --

test('webhook.validateWebhookUrl accepts valid https webhook URL', function() {
    assert.equal(webhook.validateWebhookUrl('https://webhook.office.com/abc'), true);
    assert.equal(webhook.validateWebhookUrl('https://my-webhook.example.com/hook'), true);
});

test('webhook.validateWebhookUrl rejects http URLs', function() {
    assert.equal(webhook.validateWebhookUrl('http://webhook.office.com/abc'), false);
});

test('webhook.validateWebhookUrl rejects non-webhook hostnames', function() {
    assert.equal(webhook.validateWebhookUrl('https://example.com/abc'), false);
});

test('webhook.validateWebhookUrl rejects empty and invalid inputs', function() {
    assert.equal(webhook.validateWebhookUrl(''), false);
    assert.equal(webhook.validateWebhookUrl(null), false);
    assert.equal(webhook.validateWebhookUrl(undefined), false);
    assert.equal(webhook.validateWebhookUrl('not a url'), false);
});
