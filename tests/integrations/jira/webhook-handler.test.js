'use strict';
var test = require('node:test');
var assert = require('node:assert');
var crypto = require('crypto');
var { WebhookHandler } = require('../../../src/integrations/jira/webhook-handler');

function makeSignature(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

test('WebhookHandler - valid epic created event', function () {
  var received = null;
  var handler = new WebhookHandler({
    onEpicCreated: function (issue) { received = issue; },
    issueTypes: ['Epic'],
  });
  var body = JSON.stringify({
    webhookEvent: 'jira:issue_created',
    issue: { key: 'PROJ-1', fields: { summary: 'Test', issuetype: { name: 'Epic' } } },
  });
  var result = handler.handleRequest({}, body);
  assert.equal(result.status, 200);
  assert.equal(result.response.processed, true);
  assert.equal(received.key, 'PROJ-1');
});

test('WebhookHandler - valid issue updated event', function () {
  var received = null;
  var handler = new WebhookHandler({
    onIssueUpdated: function (issue, changelog) { received = { issue: issue, changelog: changelog }; },
    issueTypes: ['Story'],
  });
  var body = JSON.stringify({
    webhookEvent: 'jira:issue_updated',
    issue: { key: 'PROJ-2', fields: { summary: 'Updated', issuetype: { name: 'Story' } } },
    changelog: { items: [{ field: 'status', toString: 'Done' }] },
  });
  var result = handler.handleRequest({}, body);
  assert.equal(result.status, 200);
  assert.ok(received);
  assert.equal(received.changelog.items[0].field, 'status');
});

test('WebhookHandler - ignores irrelevant issue types', function () {
  var called = false;
  var handler = new WebhookHandler({
    onEpicCreated: function () { called = true; },
    issueTypes: ['Epic'],
  });
  var body = JSON.stringify({
    webhookEvent: 'jira:issue_created',
    issue: { key: 'PROJ-3', fields: { issuetype: { name: 'Bug' } } },
  });
  var result = handler.handleRequest({}, body);
  assert.equal(result.status, 200);
  assert.equal(result.response.ignored, true);
  assert.equal(called, false);
});

test('WebhookHandler - ignores unsupported events', function () {
  var handler = new WebhookHandler();
  var body = JSON.stringify({ webhookEvent: 'project_created' });
  var result = handler.handleRequest({}, body);
  assert.equal(result.status, 200);
  assert.equal(result.response.ignored, true);
});

test('WebhookHandler - invalid JSON returns 400', function () {
  var handler = new WebhookHandler();
  var result = handler.handleRequest({}, 'not json{{{');
  assert.equal(result.status, 400);
});

test('WebhookHandler - signature verification passes', function () {
  var secret = 'test-secret';
  var handler = new WebhookHandler({ secret: secret });
  var body = JSON.stringify({ webhookEvent: 'sprint_started' });
  var sig = makeSignature(secret, body);
  var result = handler.handleRequest({ 'x-hub-signature': sig }, body);
  assert.equal(result.status, 200);
});

test('WebhookHandler - signature verification fails', function () {
  var handler = new WebhookHandler({ secret: 'correct-secret' });
  var body = JSON.stringify({ webhookEvent: 'jira:issue_created' });
  var result = handler.handleRequest({ 'x-hub-signature': 'sha256=wrong' }, body);
  assert.equal(result.status, 401);
});

test('WebhookHandler - no signature header fails when secret set', function () {
  var handler = new WebhookHandler({ secret: 'secret' });
  var body = JSON.stringify({ webhookEvent: 'jira:issue_created' });
  var result = handler.handleRequest({}, body);
  assert.equal(result.status, 401);
});

test('WebhookHandler - parseEvent extracts fields', function () {
  var handler = new WebhookHandler();
  var event = handler.parseEvent({
    webhookEvent: 'jira:issue_created',
    issue: { key: 'X-1' },
    changelog: { items: [] },
  });
  assert.equal(event.eventType, 'jira:issue_created');
  assert.equal(event.issue.key, 'X-1');
  assert.ok(event.changelog);
});

test('WebhookHandler - parseEvent returns null for unknown', function () {
  var handler = new WebhookHandler();
  assert.equal(handler.parseEvent({ webhookEvent: 'unknown' }), null);
  assert.equal(handler.parseEvent(null), null);
});
