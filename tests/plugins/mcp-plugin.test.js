'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MCPPlugin } = require('../../src/plugins/mcp-plugin');

describe('MCPPlugin', () => {
    beforeEach(() => {
        MCPPlugin._clearAll();
    });

    describe('register / unregister', () => {
        it('registers an MCP tool plugin', () => {
            const config = {
                type: 'mcp_tool',
                name: 'test-tool',
                description: 'A test tool',
                command: 'echo hello',
                parameters: [
                    { name: 'input', type: 'string', description: 'Input value', required: true },
                ],
            };

            const result = MCPPlugin.register(config);
            assert.equal(result.success, true);

            const tools = MCPPlugin.listRegistered();
            assert.equal(tools.length, 1);
            assert.equal(tools[0].name, 'test-tool');
        });

        it('prevents duplicate registration', () => {
            const config = {
                type: 'mcp_tool',
                name: 'dup-tool',
                description: 'Dup',
                command: 'echo ok',
            };

            MCPPlugin.register(config);
            const second = MCPPlugin.register(config);
            assert.equal(second.success, false);
            assert.ok(second.error.includes('already registered'));
        });

        it('rejects invalid type', () => {
            const result = MCPPlugin.register({ type: 'agent', name: 'x' });
            assert.equal(result.success, false);
        });

        it('unregisters a tool', () => {
            MCPPlugin.register({ type: 'mcp_tool', name: 'rm-tool', description: 'x', command: 'echo ok' });
            const result = MCPPlugin.unregister('rm-tool');
            assert.equal(result.success, true);
            assert.equal(MCPPlugin.listRegistered().length, 0);
        });

        it('returns error when unregistering unknown tool', () => {
            const result = MCPPlugin.unregister('nonexistent');
            assert.equal(result.success, false);
        });
    });

    describe('_sanitizeValue', () => {
        it('wraps normal values in single quotes', () => {
            const result = MCPPlugin._sanitizeValue('hello');
            assert.equal(result, "'hello'");
        });

        it('blocks shell pipe metacharacter via quoting', () => {
            const result = MCPPlugin._sanitizeValue('foo|bar');
            assert.equal(result, "'foo|bar'");
            // The value is safely quoted -- pipe is literal inside single quotes
        });

        it('blocks semicolon metacharacter via quoting', () => {
            const result = MCPPlugin._sanitizeValue('foo;rm -rf /');
            assert.equal(result, "'foo;rm -rf /'");
        });

        it('blocks ampersand via quoting', () => {
            const result = MCPPlugin._sanitizeValue('foo&bar');
            assert.equal(result, "'foo&bar'");
        });

        it('blocks redirection operators via quoting', () => {
            const result = MCPPlugin._sanitizeValue('foo>bar');
            assert.equal(result, "'foo>bar'");
            const result2 = MCPPlugin._sanitizeValue('foo<bar');
            assert.equal(result2, "'foo<bar'");
        });

        it('blocks backtick via quoting', () => {
            const result = MCPPlugin._sanitizeValue('`whoami`');
            assert.equal(result, "'`whoami`'");
        });

        it('blocks $() command substitution via quoting', () => {
            const result = MCPPlugin._sanitizeValue('$(cat /etc/passwd)');
            assert.equal(result, "'$(cat /etc/passwd)'");
        });

        it('escapes single quotes in values using POSIX approach', () => {
            const result = MCPPlugin._sanitizeValue("it's a test");
            assert.equal(result, "'it'\\''s a test'");
        });

        it('handles path traversal attempts', () => {
            const result = MCPPlugin._sanitizeValue('../../etc/passwd');
            assert.equal(result, "'../../etc/passwd'");
        });

        it('handles empty string', () => {
            const result = MCPPlugin._sanitizeValue('');
            assert.equal(result, "''");
        });

        it('handles numeric values', () => {
            const result = MCPPlugin._sanitizeValue(42);
            assert.equal(result, "'42'");
        });
    });

    describe('execute', () => {
        it('substitutes parameters with sanitized values', async () => {
            const config = {
                type: 'mcp_tool',
                name: 'echo-tool',
                command: 'echo {{params.msg}}',
                timeout_ms: 5000,
            };

            const result = await MCPPlugin.execute(config, { msg: 'hello world' });
            assert.equal(result.success, true);
            assert.ok(result.output.includes('hello world'));
            assert.ok(result.duration_ms >= 0);
        });

        it('handles timeout', async () => {
            const config = {
                type: 'mcp_tool',
                name: 'slow-tool',
                command: 'sleep 60',
                timeout_ms: 300,
            };

            const result = await MCPPlugin.execute(config, {});
            assert.equal(result.success, false);
            assert.ok(result.output.includes('Timeout') || result.output.includes('timeout') || result.output.includes('killed'));
        });

        it('returns error for missing command', async () => {
            const config = {
                type: 'mcp_tool',
                name: 'no-cmd',
            };

            const result = await MCPPlugin.execute(config, {});
            assert.equal(result.success, false);
            assert.ok(result.output.includes('no command'));
        });

        it('safely handles shell metacharacters in params', async () => {
            const config = {
                type: 'mcp_tool',
                name: 'safe-tool',
                command: 'echo {{params.input}}',
                timeout_ms: 5000,
            };

            // The semicolon should NOT execute as a separate command
            const result = await MCPPlugin.execute(config, { input: 'safe;echo INJECTED' });
            assert.equal(result.success, true);
            // The output should contain the literal semicolon string, not INJECTED on a separate line
            assert.ok(result.output.includes('safe;echo INJECTED'));
        });
    });

    describe('getMCPDefinition / toMCPToolDefinition', () => {
        it('returns null for unregistered tool', () => {
            const result = MCPPlugin.getMCPDefinition('nonexistent');
            assert.equal(result, null);
        });

        it('returns correct MCP definition structure', () => {
            MCPPlugin.register({
                type: 'mcp_tool',
                name: 'def-tool',
                description: 'A defined tool',
                command: 'echo ok',
                parameters: [
                    { name: 'file', type: 'string', description: 'File path', required: true },
                    { name: 'verbose', type: 'boolean', description: 'Verbose output', required: false, default: false },
                ],
            });

            const def = MCPPlugin.getMCPDefinition('def-tool');
            assert.ok(def);
            assert.equal(def.name, 'def-tool');
            assert.equal(def.description, 'A defined tool');
            assert.ok(def.inputSchema);
            assert.equal(def.inputSchema.type, 'object');
            assert.ok(def.inputSchema.properties.file);
            assert.equal(def.inputSchema.properties.file.type, 'string');
            assert.deepEqual(def.inputSchema.required, ['file']);
            assert.equal(def.inputSchema.properties.verbose.default, false);
        });
    });
});
