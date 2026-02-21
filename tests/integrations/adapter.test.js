'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { IntegrationAdapter } = require('../../src/integrations/adapter');

// Concrete implementation for testing
class TestAdapter extends IntegrationAdapter {
  constructor(options) {
    super('test', options);
  }
}

describe('IntegrationAdapter', () => {
  it('cannot be instantiated directly', () => {
    assert.throws(() => new IntegrationAdapter('direct'), {
      message: /abstract.*cannot be instantiated/i,
    });
  });

  it('can be subclassed', () => {
    const adapter = new TestAdapter();
    assert.equal(adapter.name, 'test');
  });

  it('has default retry options', () => {
    const adapter = new TestAdapter();
    assert.equal(adapter.maxRetries, 3);
    assert.equal(adapter.baseDelay, 1000);
    assert.equal(adapter.maxDelay, 30000);
  });

  it('accepts custom retry options', () => {
    const adapter = new TestAdapter({ maxRetries: 5, baseDelay: 500, maxDelay: 10000 });
    assert.equal(adapter.maxRetries, 5);
    assert.equal(adapter.baseDelay, 500);
    assert.equal(adapter.maxDelay, 10000);
  });

  describe('abstract methods throw', () => {
    let adapter;
    beforeEach(() => { adapter = new TestAdapter(); });

    it('importProject throws', async () => {
      await assert.rejects(() => adapter.importProject('id'), {
        message: /importProject.*not implemented/,
      });
    });

    it('syncStatus throws', async () => {
      await assert.rejects(() => adapter.syncStatus('id', 'ACT'), {
        message: /syncStatus.*not implemented/,
      });
    });

    it('postComment throws', async () => {
      await assert.rejects(() => adapter.postComment('id', 'text'), {
        message: /postComment.*not implemented/,
      });
    });

    it('createSubtasks throws', async () => {
      await assert.rejects(() => adapter.createSubtasks('id', []), {
        message: /createSubtasks.*not implemented/,
      });
    });

    it('getWebhookHandler throws', () => {
      assert.throws(() => adapter.getWebhookHandler(), {
        message: /getWebhookHandler.*not implemented/,
      });
    });
  });

  describe('withRetry', () => {
    it('returns result on first success', async () => {
      const adapter = new TestAdapter({ baseDelay: 1 });
      const result = await adapter.withRetry('op', async () => 42);
      assert.equal(result, 42);
    });

    it('emits success event on success', async () => {
      const adapter = new TestAdapter({ baseDelay: 1 });
      let emitted = null;
      adapter.on('success', (data) => { emitted = data; });

      await adapter.withRetry('testOp', async () => 'ok');
      assert.equal(emitted.integration, 'test');
      assert.equal(emitted.operation, 'testOp');
      assert.equal(emitted.attempt, 0);
    });

    it('retries on failure and eventually succeeds', async () => {
      const adapter = new TestAdapter({ maxRetries: 3, baseDelay: 1 });
      let calls = 0;
      const retryEvents = [];
      adapter.on('retry', (data) => retryEvents.push(data));

      const result = await adapter.withRetry('op', async () => {
        calls++;
        if (calls < 3) throw new Error('fail');
        return 'success';
      });

      assert.equal(result, 'success');
      assert.equal(calls, 3);
      assert.equal(retryEvents.length, 2);
      assert.equal(retryEvents[0].attempt, 1);
      assert.equal(retryEvents[1].attempt, 2);
    });

    it('throws after exhausting retries', async () => {
      const adapter = new TestAdapter({ maxRetries: 2, baseDelay: 1 });
      let failureEvent = null;
      adapter.on('failure', (data) => { failureEvent = data; });

      await assert.rejects(
        () => adapter.withRetry('op', async () => { throw new Error('always fail'); }),
        { message: 'always fail' }
      );

      assert.equal(failureEvent.integration, 'test');
      assert.equal(failureEvent.operation, 'op');
      assert.equal(failureEvent.attempts, 3);
    });

    it('applies exponential backoff capped at maxDelay', async () => {
      const delays = [];
      const adapter = new TestAdapter({ maxRetries: 4, baseDelay: 10, maxDelay: 50 });
      // Override _sleep to capture delays
      adapter._sleep = async (ms) => { delays.push(ms); };

      let calls = 0;
      try {
        await adapter.withRetry('op', async () => {
          calls++;
          throw new Error('fail');
        });
      } catch (e) { /* expected */ }

      // Delays: 10, 20, 40, 50 (capped)
      assert.equal(delays.length, 4);
      assert.equal(delays[0], 10);
      assert.equal(delays[1], 20);
      assert.equal(delays[2], 40);
      assert.equal(delays[3], 50); // capped at maxDelay
    });
  });

  describe('EventEmitter', () => {
    it('is an EventEmitter', () => {
      const adapter = new TestAdapter();
      assert.equal(typeof adapter.on, 'function');
      assert.equal(typeof adapter.emit, 'function');
      assert.equal(typeof adapter.removeListener, 'function');
    });

    it('emits custom events', () => {
      const adapter = new TestAdapter();
      let received = null;
      adapter.on('custom', (data) => { received = data; });
      adapter.emit('custom', { key: 'value' });
      assert.deepEqual(received, { key: 'value' });
    });
  });
});
