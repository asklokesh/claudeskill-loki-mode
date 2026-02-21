'use strict';
var test = require('node:test');
var assert = require('node:assert');
var { AgentCard } = require('../../../src/protocols/a2a/agent-card');

test('AgentCard - default card structure', function () {
  var card = new AgentCard();
  var json = card.toJSON();
  assert.equal(json.name, 'Loki Mode');
  assert.ok(json.id);
  assert.ok(json.url);
  assert.ok(json.capabilities);
  assert.equal(json.capabilities.streaming, true);
  assert.ok(Array.isArray(json.skills));
  assert.ok(json.skills.length > 0);
  assert.ok(json.authentication.schemes.includes('bearer'));
});

test('AgentCard - custom options', function () {
  var card = new AgentCard({ name: 'TestAgent', url: 'https://test.com', version: '2.0' });
  var json = card.toJSON();
  assert.equal(json.name, 'TestAgent');
  assert.equal(json.url, 'https://test.com');
  assert.equal(json.version, '2.0');
});

test('AgentCard - addSkill', function () {
  var card = new AgentCard({ skills: [] });
  card.addSkill({ id: 'custom', name: 'Custom Skill', description: 'Test' });
  assert.equal(card.getSkills().length, 1);
  assert.equal(card.getSkills()[0].id, 'custom');
});

test('AgentCard - addSkill requires id and name', function () {
  var card = new AgentCard();
  assert.throws(function () { card.addSkill({}); }, /id and name/);
  assert.throws(function () { card.addSkill(null); }, /id and name/);
});

test('AgentCard - handleRequest serves card', function () {
  var card = new AgentCard();
  var statusCode, headers, body;
  var res = {
    writeHead: function (s, h) { statusCode = s; headers = h; },
    end: function (b) { body = b; },
  };
  var handled = card.handleRequest({ url: '/.well-known/agent.json', method: 'GET' }, res);
  assert.equal(handled, true);
  assert.equal(statusCode, 200);
  assert.equal(headers['Content-Type'], 'application/json');
  var parsed = JSON.parse(body);
  assert.equal(parsed.name, 'Loki Mode');
});

test('AgentCard - handleRequest ignores other paths', function () {
  var card = new AgentCard();
  var handled = card.handleRequest({ url: '/other', method: 'GET' }, {});
  assert.equal(handled, false);
});

test('AgentCard - HEAD request', function () {
  var card = new AgentCard();
  var ended = false;
  var res = {
    writeHead: function () {},
    end: function (b) { ended = true; assert.equal(b, undefined); },
  };
  card.handleRequest({ url: '/.well-known/agent.json', method: 'HEAD' }, res);
  assert.equal(ended, true);
});

test('AgentCard - streaming disabled', function () {
  var card = new AgentCard({ streaming: false });
  assert.equal(card.toJSON().capabilities.streaming, false);
});
