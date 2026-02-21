'use strict';
var test = require('node:test');
var assert = require('node:assert');
var { JiraApiClient, JiraApiError } = require('../../../src/integrations/jira/api-client');

function makeClient() {
  return new JiraApiClient({
    baseUrl: 'https://test.atlassian.net',
    email: 'user@test.com',
    apiToken: 'token123',
    rateDelayMs: 0,
  });
}

// Mock _request to avoid real HTTP calls
function mockClient(responses) {
  var client = makeClient();
  var calls = [];
  client._request = function (method, path, body) {
    calls.push({ method: method, path: path, body: body });
    var resp = responses.shift();
    if (resp && resp.error) return Promise.reject(resp.error);
    return Promise.resolve(resp || null);
  };
  client._calls = calls;
  return client;
}

test('JiraApiClient - constructor requires options', function () {
  assert.throws(function () { new JiraApiClient(); }, /baseUrl/);
  assert.throws(function () { new JiraApiClient({ baseUrl: 'x' }); }, /email/);
});

test('JiraApiClient - auth header is base64', function () {
  var client = makeClient();
  var auth = client.getAuthHeader();
  assert.ok(auth.startsWith('Basic '));
  var decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString();
  assert.equal(decoded, 'user@test.com:token123');
});

test('JiraApiClient - getIssue', async function () {
  var client = mockClient([{ key: 'PROJ-1', fields: { summary: 'Test' } }]);
  var result = await client.getIssue('PROJ-1');
  assert.equal(result.key, 'PROJ-1');
  assert.equal(client._calls[0].method, 'GET');
  assert.ok(client._calls[0].path.includes('/rest/api/3/issue/PROJ-1'));
});

test('JiraApiClient - searchIssues', async function () {
  var client = mockClient([{ issues: [{ key: 'PROJ-1' }], total: 1 }]);
  var result = await client.searchIssues('project = PROJ', ['summary']);
  assert.equal(result.total, 1);
  assert.equal(client._calls[0].method, 'POST');
  assert.equal(client._calls[0].body.jql, 'project = PROJ');
});

test('JiraApiClient - getEpicChildren', async function () {
  var client = mockClient([{ issues: [{ key: 'PROJ-2' }], total: 1 }]);
  var result = await client.getEpicChildren('PROJ-1');
  assert.ok(client._calls[0].body.jql.includes('PROJ-1'));
});

test('JiraApiClient - createIssue', async function () {
  var client = mockClient([{ key: 'PROJ-3' }]);
  var result = await client.createIssue({ summary: 'New issue' });
  assert.equal(result.key, 'PROJ-3');
  assert.equal(client._calls[0].method, 'POST');
});

test('JiraApiClient - updateIssue', async function () {
  var client = mockClient([null]);
  await client.updateIssue('PROJ-1', { summary: 'Updated' });
  assert.equal(client._calls[0].method, 'PUT');
});

test('JiraApiClient - addComment', async function () {
  var client = mockClient([{ id: 'comment-1' }]);
  var result = await client.addComment('PROJ-1', 'Hello');
  assert.equal(result.id, 'comment-1');
  // Body should be ADF format
  assert.equal(client._calls[0].body.body.type, 'doc');
});

test('JiraApiClient - transitionIssue', async function () {
  var client = mockClient([null]);
  await client.transitionIssue('PROJ-1', '31');
  assert.equal(client._calls[0].body.transition.id, '31');
});

test('JiraApiClient - getTransitions', async function () {
  var client = mockClient([{ transitions: [{ id: '31', name: 'Done' }] }]);
  var result = await client.getTransitions('PROJ-1');
  assert.equal(result.transitions.length, 1);
});

test('JiraApiClient - addRemoteLink', async function () {
  var client = mockClient([{ id: 'link-1' }]);
  await client.addRemoteLink('PROJ-1', 'https://app.com', 'Production');
  assert.equal(client._calls[0].body.object.url, 'https://app.com');
  assert.equal(client._calls[0].body.object.title, 'Production');
});

test('JiraApiClient - error handling', async function () {
  var client = mockClient([{ error: new JiraApiError(404, 'Not found', '') }]);
  await assert.rejects(client.getIssue('PROJ-999'), function (err) {
    return err.status === 404;
  });
});
