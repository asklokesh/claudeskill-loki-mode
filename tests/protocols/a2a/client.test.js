'use strict';
var test = require('node:test');
var assert = require('node:assert');
var http = require('http');
var { A2AClient } = require('../../../src/protocols/a2a/client');

function startMockServer(handler) {
  return new Promise(function (resolve) {
    var server = http.createServer(handler);
    server.listen(0, '127.0.0.1', function () {
      var port = server.address().port;
      resolve({ server: server, url: 'http://127.0.0.1:' + port });
    });
  });
}

test('A2AClient - discover agent card', async function () {
  var cardJson = { id: 'test', name: 'Test Agent', skills: [] };
  var ctx = await startMockServer(function (req, res) {
    if (req.url === '/.well-known/agent.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cardJson));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  try {
    var client = new A2AClient();
    var card = await client.discover(ctx.url);
    assert.equal(card.name, 'Test Agent');
  } finally { ctx.server.close(); }
});

test('A2AClient - submit task', async function () {
  var receivedBody;
  var ctx = await startMockServer(function (req, res) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      receivedBody = JSON.parse(Buffer.concat(chunks).toString());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'task-1', state: 'submitted', skill: receivedBody.skill }));
    });
  });
  try {
    var client = new A2AClient();
    var task = await client.submitTask(ctx.url, { skill: 'prd-to-product', input: { prd: 'test' } });
    assert.equal(task.id, 'task-1');
    assert.equal(task.state, 'submitted');
    assert.equal(receivedBody.skill, 'prd-to-product');
  } finally { ctx.server.close(); }
});

test('A2AClient - get task status', async function () {
  var ctx = await startMockServer(function (req, res) {
    if (req.url === '/tasks/task-1') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'task-1', state: 'working' }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  try {
    var client = new A2AClient();
    var status = await client.getTaskStatus(ctx.url, 'task-1');
    assert.equal(status.state, 'working');
  } finally { ctx.server.close(); }
});

test('A2AClient - cancel task', async function () {
  var ctx = await startMockServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'task-1', state: 'canceled' }));
  });
  try {
    var client = new A2AClient();
    var result = await client.cancelTask(ctx.url, 'task-1');
    assert.equal(result.state, 'canceled');
  } finally { ctx.server.close(); }
});

test('A2AClient - handles HTTP errors', async function () {
  var ctx = await startMockServer(function (req, res) {
    res.writeHead(401);
    res.end('Unauthorized');
  });
  try {
    var client = new A2AClient();
    await assert.rejects(
      client.discover(ctx.url),
      function (err) { return err.statusCode === 401; }
    );
  } finally { ctx.server.close(); }
});

test('A2AClient - auth token sent in header', async function () {
  var receivedHeaders;
  var ctx = await startMockServer(function (req, res) {
    receivedHeaders = req.headers;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  try {
    var client = new A2AClient({ authToken: 'secret-token' });
    await client.discover(ctx.url);
    assert.equal(receivedHeaders['authorization'], 'Bearer secret-token');
  } finally { ctx.server.close(); }
});

test('A2AClient - stream task receives SSE events', async function () {
  var ctx = await startMockServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write('event: progress\ndata: {"taskId":"t1","message":"building"}\n\n');
    res.write('event: state\ndata: {"taskId":"t1","from":"working","to":"completed"}\n\n');
    setTimeout(function () { res.end(); }, 50);
  });
  try {
    var client = new A2AClient();
    var emitter = client.streamTask(ctx.url, 't1');
    var events = [];
    await new Promise(function (resolve) {
      emitter.on('event', function (e) { events.push(e); });
      emitter.on('end', resolve);
    });
    assert.equal(events.length, 2);
    assert.equal(events[0].event, 'progress');
    assert.equal(events[0].data.message, 'building');
    assert.equal(events[1].event, 'state');
  } finally { ctx.server.close(); }
});
