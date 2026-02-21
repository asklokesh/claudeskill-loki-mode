'use strict';
var test = require('node:test');
var assert = require('node:assert');
var { createArtifact, validateArtifact, VALID_TYPES } = require('../../../src/protocols/a2a/artifacts');

test('createArtifact - creates valid artifact', function () {
  var a = createArtifact('code', 'console.log("hello")', { language: 'javascript' });
  assert.ok(a.id);
  assert.equal(a.type, 'code');
  assert.equal(a.mimeType, 'text/plain');
  assert.equal(a.content, 'console.log("hello")');
  assert.deepStrictEqual(a.metadata, { language: 'javascript' });
  assert.ok(a.createdAt);
});

test('createArtifact - all valid types', function () {
  VALID_TYPES.forEach(function (type) {
    var a = createArtifact(type, 'content');
    assert.equal(a.type, type);
    assert.ok(a.mimeType);
  });
});

test('createArtifact - invalid type throws', function () {
  assert.throws(function () { createArtifact('invalid', 'x'); }, /Invalid artifact type/);
  assert.throws(function () { createArtifact('', 'x'); }, /Invalid artifact type/);
});

test('createArtifact - null content throws', function () {
  assert.throws(function () { createArtifact('code', null); }, /content is required/);
  assert.throws(function () { createArtifact('code', undefined); }, /content is required/);
});

test('validateArtifact - valid artifact', function () {
  var a = createArtifact('code', 'test');
  var result = validateArtifact(a);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateArtifact - null input', function () {
  var result = validateArtifact(null);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateArtifact - missing fields', function () {
  var result = validateArtifact({ type: 'code' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(function (e) { return e.includes('id'); }));
  assert.ok(result.errors.some(function (e) { return e.includes('content'); }));
});

test('validateArtifact - invalid type', function () {
  var result = validateArtifact({ id: '1', type: 'bad', content: 'x', createdAt: 'now' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(function (e) { return e.includes('Invalid type'); }));
});

test('createArtifact - deployment type has JSON mime', function () {
  var a = createArtifact('deployment', { url: 'https://app.com' });
  assert.equal(a.mimeType, 'application/json');
});
