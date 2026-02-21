'use strict';
var test = require('node:test');
var assert = require('node:assert');
var { TaskManager } = require('../../../src/protocols/a2a/task-manager');

test('TaskManager - create task', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'prd-to-product', input: { prd: 'test' } });
  assert.ok(task.id);
  assert.equal(task.skill, 'prd-to-product');
  assert.equal(task.state, 'submitted');
  assert.deepStrictEqual(task.input, { prd: 'test' });
  assert.equal(task.history.length, 1);
  tm.destroy();
});

test('TaskManager - create task requires skill', function () {
  var tm = new TaskManager();
  assert.throws(function () { tm.createTask({}); }, /skill/);
  assert.throws(function () { tm.createTask(null); }, /skill/);
  tm.destroy();
});

test('TaskManager - get task', function () {
  var tm = new TaskManager();
  var created = tm.createTask({ skill: 'test' });
  var fetched = tm.getTask(created.id);
  assert.equal(fetched.id, created.id);
  assert.equal(tm.getTask('nonexistent'), null);
  tm.destroy();
});

test('TaskManager - update task state', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  var updated = tm.updateTask(task.id, { state: 'working' });
  assert.equal(updated.state, 'working');
  assert.equal(updated.history.length, 2);
  tm.destroy();
});

test('TaskManager - invalid state transition', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  assert.throws(function () {
    tm.updateTask(task.id, { state: 'completed' });
  }, /Invalid transition/);
  tm.destroy();
});

test('TaskManager - full lifecycle: submitted -> working -> completed', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  tm.updateTask(task.id, { state: 'working' });
  var completed = tm.updateTask(task.id, { state: 'completed', output: { result: 'done' } });
  assert.equal(completed.state, 'completed');
  assert.deepStrictEqual(completed.output, { result: 'done' });
  assert.equal(completed.history.length, 3);
  tm.destroy();
});

test('TaskManager - cannot update terminal state', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  tm.updateTask(task.id, { state: 'working' });
  tm.updateTask(task.id, { state: 'completed' });
  assert.throws(function () {
    tm.updateTask(task.id, { state: 'working' });
  }, /terminal state/);
  tm.destroy();
});

test('TaskManager - cancel task', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  var canceled = tm.cancelTask(task.id);
  assert.equal(canceled.state, 'canceled');
  tm.destroy();
});

test('TaskManager - cannot cancel terminal task', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  tm.cancelTask(task.id);
  assert.throws(function () { tm.cancelTask(task.id); }, /terminal state/);
  tm.destroy();
});

test('TaskManager - input-required state', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  tm.updateTask(task.id, { state: 'working' });
  var ir = tm.updateTask(task.id, { state: 'input-required', message: 'Need clarification' });
  assert.equal(ir.state, 'input-required');
  assert.equal(ir.message, 'Need clarification');
  // Can go back to working
  var working = tm.updateTask(task.id, { state: 'working' });
  assert.equal(working.state, 'working');
  tm.destroy();
});

test('TaskManager - list tasks with filter', function () {
  var tm = new TaskManager();
  tm.createTask({ skill: 'a' });
  tm.createTask({ skill: 'b' });
  var t3 = tm.createTask({ skill: 'a' });
  tm.updateTask(t3.id, { state: 'working' });
  assert.equal(tm.listTasks().length, 3);
  assert.equal(tm.listTasks({ skill: 'a' }).length, 2);
  assert.equal(tm.listTasks({ state: 'working' }).length, 1);
  tm.destroy();
});

test('TaskManager - max tasks limit', function () {
  var tm = new TaskManager({ maxTasks: 3 });
  tm.createTask({ skill: 'a' });
  tm.createTask({ skill: 'b' });
  tm.createTask({ skill: 'c' });
  assert.throws(function () { tm.createTask({ skill: 'd' }); }, /Maximum task limit/);
  tm.destroy();
});

test('TaskManager - emits events', function () {
  var tm = new TaskManager();
  var events = [];
  tm.on('task:created', function (t) { events.push('created:' + t.skill); });
  tm.on('task:stateChange', function (e) { events.push('state:' + e.to); });
  var task = tm.createTask({ skill: 'test' });
  tm.updateTask(task.id, { state: 'working' });
  assert.deepStrictEqual(events, ['created:test', 'state:working']);
  tm.destroy();
});

test('TaskManager - artifacts accumulate', function () {
  var tm = new TaskManager();
  var task = tm.createTask({ skill: 'test' });
  tm.updateTask(task.id, { state: 'working', artifacts: [{ id: '1', type: 'code' }] });
  var updated = tm.updateTask(task.id, { artifacts: [{ id: '2', type: 'log' }] });
  assert.equal(updated.artifacts.length, 2);
  tm.destroy();
});

test('TaskManager - update nonexistent task', function () {
  var tm = new TaskManager();
  assert.throws(function () { tm.updateTask('fake', { state: 'working' }); }, /not found/);
  tm.destroy();
});

test('TaskManager - size', function () {
  var tm = new TaskManager();
  assert.equal(tm.size(), 0);
  tm.createTask({ skill: 'a' });
  assert.equal(tm.size(), 1);
  tm.destroy();
});
