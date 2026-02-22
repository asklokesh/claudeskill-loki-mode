'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { IntegrationPlugin } = require('../../src/plugins/integration-plugin');

describe('IntegrationPlugin', () => {
    beforeEach(() => {
        IntegrationPlugin._clearAll();
    });

    describe('register / unregister lifecycle', () => {
        it('registers an integration plugin', () => {
            const config = {
                type: 'integration',
                name: 'test-hook',
                description: 'A test webhook',
                webhook_url: 'https://example.com/hook',
                events: ['task.completed'],
            };

            const result = IntegrationPlugin.register(config);
            assert.equal(result.success, true);

            const list = IntegrationPlugin.listRegistered();
            assert.equal(list.length, 1);
            assert.equal(list[0].name, 'test-hook');
        });

        it('prevents duplicate registration', () => {
            const config = {
                type: 'integration',
                name: 'dup-hook',
                description: 'Dup',
                webhook_url: 'https://example.com/hook',
                events: ['task.completed'],
            };

            IntegrationPlugin.register(config);
            const second = IntegrationPlugin.register(config);
            assert.equal(second.success, false);
            assert.ok(second.error.includes('already registered'));
        });

        it('rejects invalid type', () => {
            const result = IntegrationPlugin.register({ type: 'agent', name: 'x' });
            assert.equal(result.success, false);
        });

        it('unregisters an integration plugin', () => {
            IntegrationPlugin.register({
                type: 'integration',
                name: 'rm-hook',
                description: 'x',
                webhook_url: 'https://example.com/hook',
                events: ['*'],
            });

            const result = IntegrationPlugin.unregister('rm-hook');
            assert.equal(result.success, true);
            assert.equal(IntegrationPlugin.listRegistered().length, 0);
        });

        it('returns error when unregistering unknown integration', () => {
            const result = IntegrationPlugin.unregister('nonexistent');
            assert.equal(result.success, false);
        });
    });

    describe('renderTemplate', () => {
        it('substitutes simple string values', () => {
            const template = '{"type": "{{event.type}}"}';
            const result = IntegrationPlugin.renderTemplate(template, { type: 'task.done' });
            assert.equal(result, '{"type": "task.done"}');
        });

        it('handles nested field access', () => {
            const template = '{"val": "{{event.data.name}}"}';
            const result = IntegrationPlugin.renderTemplate(template, { data: { name: 'test' } });
            assert.equal(result, '{"val": "test"}');
        });

        it('serializes object values as JSON', () => {
            const template = '{"payload": {{event.data}}}';
            const result = IntegrationPlugin.renderTemplate(template, { data: { a: 1, b: 2 } });
            assert.equal(result, '{"payload": {"a":1,"b":2}}');
        });

        it('JSON-escapes string values containing double quotes', () => {
            const template = '{"msg": "{{event.message}}"}';
            const result = IntegrationPlugin.renderTemplate(template, { message: 'He said "hello"' });
            // JSON.stringify escapes internal quotes
            assert.equal(result, '{"msg": "He said \\"hello\\""}');
            // Verify the whole thing is valid JSON
            const parsed = JSON.parse(result);
            assert.equal(parsed.msg, 'He said "hello"');
        });

        it('JSON-escapes backslashes in values', () => {
            const template = '{"path": "{{event.path}}"}';
            const result = IntegrationPlugin.renderTemplate(template, { path: 'C:\\Users\\test' });
            assert.equal(result, '{"path": "C:\\\\Users\\\\test"}');
            const parsed = JSON.parse(result);
            assert.equal(parsed.path, 'C:\\Users\\test');
        });

        it('JSON-escapes newlines in values', () => {
            const template = '{"text": "{{event.text}}"}';
            const result = IntegrationPlugin.renderTemplate(template, { text: 'line1\nline2' });
            assert.equal(result, '{"text": "line1\\nline2"}');
            const parsed = JSON.parse(result);
            assert.equal(parsed.text, 'line1\nline2');
        });

        it('returns empty string for null/undefined values', () => {
            const template = '{"val": "{{event.missing}}"}';
            const result = IntegrationPlugin.renderTemplate(template, {});
            // undefined fields are left as empty string
            assert.equal(result, '{"val": ""}');
        });

        it('preserves unmatched template variables', () => {
            const template = '{"val": "{{event.missing}}"}';
            const event = { other: 'data' };
            const result = IntegrationPlugin.renderTemplate(template, event);
            // The field resolves to empty string since event.missing is undefined
            assert.equal(result, '{"val": ""}');
        });

        it('handles empty template', () => {
            const result = IntegrationPlugin.renderTemplate('', { type: 'test' });
            assert.equal(result, '');
        });

        it('handles null template', () => {
            const result = IntegrationPlugin.renderTemplate(null, { type: 'test' });
            assert.equal(result, '');
        });
    });

    describe('handleEvent', () => {
        it('sends POST to matching webhook', async () => {
            // Create a local HTTP server to receive the webhook
            let receivedBody = null;
            const server = http.createServer((req, res) => {
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', () => {
                    receivedBody = body;
                    res.writeHead(200);
                    res.end('OK');
                });
            });

            await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
            const port = server.address().port;

            try {
                const config = {
                    type: 'integration',
                    name: 'local-hook',
                    webhook_url: `http://127.0.0.1:${port}/hook`,
                    events: ['task.completed'],
                    payload_template: '{"event": "{{event.type}}"}',
                    timeout_ms: 3000,
                    headers: {},
                };

                const result = await IntegrationPlugin.handleEvent(config, { type: 'task.completed' });
                assert.equal(result.sent, true);
                assert.equal(result.status, 200);
                assert.ok(receivedBody);
                assert.equal(JSON.parse(receivedBody).event, 'task.completed');
            } finally {
                server.close();
            }
        });

        it('returns error for unreachable webhook', async () => {
            const config = {
                type: 'integration',
                name: 'bad-hook',
                webhook_url: 'http://127.0.0.1:1/unreachable',
                events: ['task.completed'],
                payload_template: '{"event": "{{event.type}}"}',
                timeout_ms: 1000,
                headers: {},
            };

            const result = await IntegrationPlugin.handleEvent(config, { type: 'task.completed' });
            assert.equal(result.sent, false);
            assert.ok(result.error);
        });
    });

    describe('getByEvent', () => {
        it('finds integrations subscribed to an event', () => {
            IntegrationPlugin.register({
                type: 'integration',
                name: 'hook-a',
                description: 'x',
                webhook_url: 'https://example.com/a',
                events: ['task.completed'],
            });
            IntegrationPlugin.register({
                type: 'integration',
                name: 'hook-b',
                description: 'x',
                webhook_url: 'https://example.com/b',
                events: ['task.failed'],
            });

            const matches = IntegrationPlugin.getByEvent('task.completed');
            assert.equal(matches.length, 1);
            assert.equal(matches[0].name, 'hook-a');
        });

        it('matches wildcard subscriptions', () => {
            IntegrationPlugin.register({
                type: 'integration',
                name: 'hook-wild',
                description: 'x',
                webhook_url: 'https://example.com/wild',
                events: ['*'],
            });

            const matches = IntegrationPlugin.getByEvent('anything.at.all');
            assert.equal(matches.length, 1);
            assert.equal(matches[0].name, 'hook-wild');
        });

        it('returns empty array for non-matching event', () => {
            IntegrationPlugin.register({
                type: 'integration',
                name: 'hook-c',
                description: 'x',
                webhook_url: 'https://example.com/c',
                events: ['task.completed'],
            });

            const matches = IntegrationPlugin.getByEvent('task.failed');
            assert.equal(matches.length, 0);
        });
    });
});
