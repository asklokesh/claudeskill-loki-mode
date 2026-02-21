'use strict';
var test = require('node:test');
var assert = require('node:assert');
var { SSEStream } = require('../../../src/protocols/a2a/streaming');

test('SSEStream - sendEvent buffers without response', function () {
  var stream = new SSEStream();
  stream.sendEvent('progress', { message: 'test' });
  var buf = stream.getBuffer();
  assert.equal(buf.length, 1);
  assert.ok(buf[0].includes('event: progress'));
  assert.ok(buf[0].includes('"message":"test"'));
});

test('SSEStream - sendEvent writes to response', function () {
  var written = [];
  var stream = new SSEStream();
  stream.initResponse({
    writeHead: function () {},
    write: function (data) { written.push(data); },
  });
  stream.sendEvent('test', 'hello');
  assert.equal(written.length, 1);
  assert.ok(written[0].includes('event: test'));
  assert.ok(written[0].includes('data: hello'));
});

test('SSEStream - initResponse flushes buffer', function () {
  var written = [];
  var stream = new SSEStream();
  stream.sendEvent('a', '1');
  stream.sendEvent('b', '2');
  assert.equal(stream.getBuffer().length, 2);
  stream.initResponse({
    writeHead: function () {},
    write: function (data) { written.push(data); },
  });
  assert.equal(written.length, 2);
  assert.equal(stream.getBuffer().length, 0);
});

test('SSEStream - sendProgress', function () {
  var events = [];
  var stream = new SSEStream();
  stream.on('event', function (e) { events.push(e); });
  stream.sendProgress('task-1', 'Building...', 50);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'progress');
  assert.equal(events[0].data.taskId, 'task-1');
  assert.equal(events[0].data.progress, 50);
});

test('SSEStream - sendArtifact', function () {
  var events = [];
  var stream = new SSEStream();
  stream.on('event', function (e) { events.push(e); });
  stream.sendArtifact('task-1', { type: 'code', content: 'hello' });
  assert.equal(events[0].event, 'artifact');
  assert.equal(events[0].data.artifact.type, 'code');
});

test('SSEStream - sendStateChange', function () {
  var events = [];
  var stream = new SSEStream();
  stream.on('event', function (e) { events.push(e); });
  stream.sendStateChange('task-1', 'submitted', 'working');
  assert.equal(events[0].event, 'state');
  assert.equal(events[0].data.from, 'submitted');
  assert.equal(events[0].data.to, 'working');
});

test('SSEStream - close', function () {
  var ended = false;
  var stream = new SSEStream();
  stream.initResponse({
    writeHead: function () {},
    write: function () {},
    end: function () { ended = true; },
  });
  stream.on('close', function () {});
  stream.close();
  assert.equal(ended, true);
  assert.equal(stream.isClosed(), true);
  // Should not write after close
  stream.sendEvent('test', 'ignored');
});

test('SSEStream - initResponse sets SSE headers', function () {
  var headArgs;
  var stream = new SSEStream();
  stream.initResponse({
    writeHead: function (s, h) { headArgs = { status: s, headers: h }; },
    write: function () {},
  });
  assert.equal(headArgs.status, 200);
  assert.equal(headArgs.headers['Content-Type'], 'text/event-stream');
  assert.equal(headArgs.headers['Cache-Control'], 'no-cache');
});
