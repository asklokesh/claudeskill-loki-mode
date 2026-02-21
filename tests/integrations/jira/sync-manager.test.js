'use strict';
var test = require('node:test');
var assert = require('node:assert');
var { JiraSyncManager, mapLokiStatusToJira } = require('../../../src/integrations/jira/sync-manager');

function mockApiClient() {
  var calls = [];
  return {
    _calls: calls,
    getIssue: function (key) {
      calls.push({ method: 'getIssue', args: [key] });
      return Promise.resolve({
        key: key,
        fields: { summary: 'Test Epic', description: 'Epic description' },
      });
    },
    getEpicChildren: function (key) {
      calls.push({ method: 'getEpicChildren', args: [key] });
      return Promise.resolve({
        issues: [
          { key: key + '-1', fields: { summary: 'Story 1', description: 'Desc 1' } },
          { key: key + '-2', fields: { summary: 'Story 2', description: 'Desc 2' } },
        ],
      });
    },
    addComment: function (key, body) {
      calls.push({ method: 'addComment', args: [key, body] });
      return Promise.resolve({ id: 'comment-1' });
    },
    getTransitions: function (key) {
      calls.push({ method: 'getTransitions', args: [key] });
      return Promise.resolve({
        transitions: [
          { id: '21', name: 'In Progress', to: { name: 'In Progress' } },
          { id: '31', name: 'Done', to: { name: 'Done' } },
          { id: '41', name: 'In Review', to: { name: 'In Review' } },
        ],
      });
    },
    transitionIssue: function (key, transId) {
      calls.push({ method: 'transitionIssue', args: [key, transId] });
      return Promise.resolve(null);
    },
    addRemoteLink: function (key, url, title) {
      calls.push({ method: 'addRemoteLink', args: [key, url, title] });
      return Promise.resolve({ id: 'link-1' });
    },
    createIssue: function (fields) {
      calls.push({ method: 'createIssue', args: [fields] });
      return Promise.resolve({ key: 'PROJ-NEW-' + calls.length });
    },
  };
}

test('JiraSyncManager - constructor requires apiClient', function () {
  assert.throws(function () { new JiraSyncManager(); }, /apiClient/);
});

test('JiraSyncManager - syncFromJira converts epic to PRD', async function () {
  var api = mockApiClient();
  var sm = new JiraSyncManager({ apiClient: api });
  var result = await sm.syncFromJira('PROJ-1');
  assert.ok(result.prd.includes('Test Epic'));
  assert.ok(result.prd.includes('Story 1'));
  assert.equal(result.metadata.source, 'jira');
  assert.equal(result.metadata.epicKey, 'PROJ-1');
});

test('JiraSyncManager - syncToJira updates status and adds comment', async function () {
  var api = mockApiClient();
  var sm = new JiraSyncManager({ apiClient: api });
  await sm.syncToJira('PROJ-1', { phase: 'building', details: 'Writing code', progress: 40 });
  var transCall = api._calls.find(function (c) { return c.method === 'transitionIssue'; });
  assert.ok(transCall);
  var commentCall = api._calls.find(function (c) { return c.method === 'addComment'; });
  assert.ok(commentCall);
  assert.ok(commentCall.args[1].includes('building'));
  assert.ok(commentCall.args[1].includes('40%'));
});

test('JiraSyncManager - updateTaskStatus', async function () {
  var api = mockApiClient();
  var sm = new JiraSyncManager({ apiClient: api });
  await sm.updateTaskStatus('PROJ-2', 'deployed', 'Live at app.com');
  var transCall = api._calls.find(function (c) { return c.method === 'transitionIssue'; });
  assert.ok(transCall);
});

test('JiraSyncManager - postQualityReport', async function () {
  var api = mockApiClient();
  var sm = new JiraSyncManager({ apiClient: api });
  await sm.postQualityReport('PROJ-1', { type: 'unit', passed: 42, failed: 0, coverage: 95 });
  var commentCall = api._calls.find(function (c) { return c.method === 'addComment'; });
  assert.ok(commentCall.args[1].includes('Quality Report'));
  assert.ok(commentCall.args[1].includes('42'));
  assert.ok(commentCall.args[1].includes('95%'));
});

test('JiraSyncManager - addDeploymentLink', async function () {
  var api = mockApiClient();
  var sm = new JiraSyncManager({ apiClient: api });
  await sm.addDeploymentLink('PROJ-1', 'https://app.com', 'production');
  var linkCall = api._calls.find(function (c) { return c.method === 'addRemoteLink'; });
  assert.equal(linkCall.args[1], 'https://app.com');
  assert.ok(linkCall.args[2].includes('production'));
});

test('JiraSyncManager - createSubTasks', async function () {
  var api = mockApiClient();
  var sm = new JiraSyncManager({ apiClient: api, projectKey: 'PROJ' });
  var keys = await sm.createSubTasks('PROJ-1', [
    { title: 'Sub 1', description: 'Desc 1' },
    { title: 'Sub 2', description: 'Desc 2' },
  ]);
  assert.equal(keys.length, 2);
  var createCalls = api._calls.filter(function (c) { return c.method === 'createIssue'; });
  assert.equal(createCalls.length, 2);
  assert.equal(createCalls[0].args[0].parent.key, 'PROJ-1');
  assert.equal(createCalls[0].args[0].issuetype.name, 'Sub-task');
});

test('mapLokiStatusToJira - known mappings', function () {
  assert.equal(mapLokiStatusToJira('planning'), 'In Progress');
  assert.equal(mapLokiStatusToJira('building'), 'In Progress');
  assert.equal(mapLokiStatusToJira('testing'), 'In Review');
  assert.equal(mapLokiStatusToJira('deployed'), 'Done');
  assert.equal(mapLokiStatusToJira('failed'), 'Blocked');
});

test('mapLokiStatusToJira - unknown returns null', function () {
  assert.equal(mapLokiStatusToJira('unknown'), null);
  assert.equal(mapLokiStatusToJira(''), null);
});
