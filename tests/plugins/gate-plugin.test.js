'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { GatePlugin } = require('../../src/plugins/gate-plugin');

describe('GatePlugin', () => {
    beforeEach(() => {
        GatePlugin._clearAll();
    });

    it('registers gate plugin', () => {
        const config = {
            type: 'quality_gate',
            name: 'test-gate',
            description: 'A test gate',
            command: 'echo "all good"',
            phase: 'pre-commit',
        };

        const result = GatePlugin.register(config);
        assert.equal(result.success, true);
        assert.ok(GatePlugin.isRegistered('test-gate'));

        const gates = GatePlugin.listRegistered();
        assert.equal(gates.length, 1);
        assert.equal(gates[0].name, 'test-gate');
        assert.equal(gates[0].phase, 'pre-commit');
    });

    it('executes command and captures output', async () => {
        const config = {
            type: 'quality_gate',
            name: 'echo-gate',
            description: 'Gate that echoes',
            command: 'echo "hello from gate"',
            timeout_ms: 5000,
        };

        const result = await GatePlugin.execute(config, process.cwd());
        assert.equal(result.passed, true);
        assert.ok(result.output.includes('hello from gate'));
        assert.ok(result.duration_ms >= 0);
    });

    it('passes on exit code 0', async () => {
        const config = {
            type: 'quality_gate',
            name: 'pass-gate',
            description: 'Gate that passes',
            command: 'true',
            timeout_ms: 5000,
        };

        const result = await GatePlugin.execute(config, process.cwd());
        assert.equal(result.passed, true);
    });

    it('fails on non-zero exit code', async () => {
        const config = {
            type: 'quality_gate',
            name: 'fail-gate',
            description: 'Gate that fails',
            command: 'exit 1',
            timeout_ms: 5000,
        };

        const result = await GatePlugin.execute(config, process.cwd());
        assert.equal(result.passed, false);
        assert.ok(result.duration_ms >= 0);
    });

    it('times out on long-running command', async () => {
        const config = {
            type: 'quality_gate',
            name: 'slow-gate',
            description: 'Gate that times out',
            command: 'sleep 60',
            timeout_ms: 500,
        };

        const result = await GatePlugin.execute(config, process.cwd());
        assert.equal(result.passed, false);
        assert.ok(result.output.includes('Timeout') || result.output.includes('timeout') || result.output.includes('killed'));
    });

    it('handles missing command', async () => {
        const config = {
            type: 'quality_gate',
            name: 'no-cmd-gate',
            description: 'Gate with no command',
        };

        const result = await GatePlugin.execute(config, process.cwd());
        assert.equal(result.passed, false);
        assert.ok(result.output.includes('no command'));
    });

    it('prevents duplicate registration', () => {
        const config = {
            type: 'quality_gate',
            name: 'dup-gate',
            description: 'A gate',
            command: 'echo ok',
        };

        const first = GatePlugin.register(config);
        assert.equal(first.success, true);

        const second = GatePlugin.register(config);
        assert.equal(second.success, false);
        assert.ok(second.error.includes('already registered'));
    });

    it('unregisters gate plugin', () => {
        const config = {
            type: 'quality_gate',
            name: 'removable-gate',
            description: 'A gate to remove',
            command: 'echo ok',
        };

        GatePlugin.register(config);
        assert.ok(GatePlugin.isRegistered('removable-gate'));

        const result = GatePlugin.unregister('removable-gate');
        assert.equal(result.success, true);
        assert.ok(!GatePlugin.isRegistered('removable-gate'));
    });

    it('gets gates by phase', () => {
        GatePlugin.register({
            type: 'quality_gate', name: 'pre-gate', description: 'Pre',
            command: 'echo ok', phase: 'pre-commit',
        });
        GatePlugin.register({
            type: 'quality_gate', name: 'post-gate', description: 'Post',
            command: 'echo ok', phase: 'post-commit',
        });

        const preGates = GatePlugin.getByPhase('pre-commit');
        assert.equal(preGates.length, 1);
        assert.equal(preGates[0].name, 'pre-gate');

        const postGates = GatePlugin.getByPhase('post-commit');
        assert.equal(postGates.length, 1);
        assert.equal(postGates[0].name, 'post-gate');
    });
});
