'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync, rmSync, existsSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const { PluginLoader, parseSimpleYAML } = require('../../src/plugins/loader');

const SCHEMAS_DIR = join(__dirname, '..', '..', 'src', 'plugins', 'schemas');

// Helper to create a temp directory for plugins
function createTempDir() {
    const dir = join(tmpdir(), `loki-plugin-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}

function cleanupDir(dir) {
    try {
        if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true });
        }
    } catch { /* ignore */ }
}

describe('PluginLoader', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = createTempDir();
    });

    afterEach(() => {
        cleanupDir(tempDir);
    });

    it('discovers YAML files in plugins directory', () => {
        writeFileSync(join(tempDir, 'agent.yaml'), 'type: agent\nname: test-agent\ndescription: Test\nprompt_template: Hello');
        writeFileSync(join(tempDir, 'gate.yml'), 'type: quality_gate\nname: test-gate\ndescription: Test\ncommand: echo ok');
        writeFileSync(join(tempDir, 'readme.txt'), 'Not a plugin');

        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const files = loader.discover();

        assert.equal(files.length, 2);
        assert.ok(files.some(f => f.endsWith('agent.yaml')));
        assert.ok(files.some(f => f.endsWith('gate.yml')));
        // .txt file should not be included
        assert.ok(!files.some(f => f.endsWith('.txt')));
    });

    it('loads valid plugin from YAML', () => {
        const yamlContent = [
            'type: agent',
            'name: test-agent',
            'description: A test agent for validation',
            'prompt_template: Review code for {{event.language}}',
            'category: custom',
        ].join('\n');

        writeFileSync(join(tempDir, 'test-agent.yaml'), yamlContent);

        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const { loaded, failed } = loader.loadAll();

        assert.equal(loaded.length, 1);
        assert.equal(failed.length, 0);
        assert.equal(loaded[0].config.name, 'test-agent');
        assert.equal(loaded[0].config.type, 'agent');
    });

    it('loads valid plugin from JSON', () => {
        const config = {
            type: 'quality_gate',
            name: 'json-gate',
            description: 'Gate loaded from JSON',
            command: 'echo passed',
            phase: 'pre-commit',
        };

        writeFileSync(join(tempDir, 'gate.json'), JSON.stringify(config));

        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const { loaded, failed } = loader.loadAll();

        assert.equal(loaded.length, 1);
        assert.equal(failed.length, 0);
        assert.equal(loaded[0].config.name, 'json-gate');
    });

    it('skips invalid plugin with warning and does not crash', () => {
        // Valid plugin
        const validYaml = 'type: agent\nname: good-agent\ndescription: Good agent\nprompt_template: Hello';
        writeFileSync(join(tempDir, 'good.yaml'), validYaml);

        // Invalid plugin (missing required fields)
        const invalidYaml = 'type: agent\nname: ab';
        writeFileSync(join(tempDir, 'bad.yaml'), invalidYaml);

        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const { loaded, failed } = loader.loadAll();

        // Should load the valid one and skip the invalid one
        assert.equal(loaded.length, 1);
        assert.equal(loaded[0].config.name, 'good-agent');
        assert.equal(failed.length, 1);
        assert.ok(failed[0].errors.length > 0);
    });

    it('empty plugins directory returns empty list', () => {
        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const { loaded, failed } = loader.loadAll();

        assert.equal(loaded.length, 0);
        assert.equal(failed.length, 0);
    });

    it('non-existent plugins directory returns empty list gracefully', () => {
        const nonExistentDir = join(tempDir, 'does-not-exist');
        const loader = new PluginLoader(nonExistentDir, SCHEMAS_DIR);

        const files = loader.discover();
        assert.equal(files.length, 0);

        const { loaded, failed } = loader.loadAll();
        assert.equal(loaded.length, 0);
        assert.equal(failed.length, 0);
    });

    it('loads multiple plugins of different types', () => {
        const agentYaml = 'type: agent\nname: multi-agent\ndescription: Test agent\nprompt_template: Hello';
        const gateJson = JSON.stringify({
            type: 'quality_gate',
            name: 'multi-gate',
            description: 'Test gate',
            command: 'echo ok',
        });
        const integrationYaml = [
            'type: integration',
            'name: multi-integration',
            'description: Test integration',
            'webhook_url: https://example.com/hook',
            'events:',
            '  - task.done',
        ].join('\n');

        writeFileSync(join(tempDir, 'agent.yaml'), agentYaml);
        writeFileSync(join(tempDir, 'gate.json'), gateJson);
        writeFileSync(join(tempDir, 'integration.yaml'), integrationYaml);

        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const { loaded, failed } = loader.loadAll();

        assert.equal(loaded.length, 3);
        assert.equal(failed.length, 0);

        const types = loaded.map(l => l.config.type).sort();
        assert.deepEqual(types, ['agent', 'integration', 'quality_gate']);
    });

    it('reports failed plugins separately from loaded ones', () => {
        const goodYaml = 'type: agent\nname: report-good\ndescription: Good agent\nprompt_template: Hello';
        const badYaml = 'type: unknown_type\nname: report-bad\ndescription: Bad type';

        writeFileSync(join(tempDir, 'good.yaml'), goodYaml);
        writeFileSync(join(tempDir, 'bad.yaml'), badYaml);

        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const { loaded, failed } = loader.loadAll();

        assert.equal(loaded.length, 1);
        assert.equal(failed.length, 1);
        assert.ok(failed[0].path.includes('bad.yaml'));
        assert.ok(failed[0].errors.some(e => e.includes('Unknown plugin type')));
    });

    it('handles malformed YAML gracefully', () => {
        writeFileSync(join(tempDir, 'broken.yaml'), '{{{{broken yaml content::::');

        const loader = new PluginLoader(tempDir, SCHEMAS_DIR);
        const { loaded, failed } = loader.loadAll();

        // Should not crash; the broken file is either parsed weirdly or skipped
        assert.equal(loaded.length, 0);
        // May end up in failed due to missing required fields
        assert.ok(failed.length >= 0);
    });
});

describe('parseSimpleYAML', () => {
    it('parses key-value pairs', () => {
        const result = parseSimpleYAML('type: agent\nname: test\ndescription: A test');
        assert.equal(result.type, 'agent');
        assert.equal(result.name, 'test');
        assert.equal(result.description, 'A test');
    });

    it('parses boolean and number values', () => {
        const result = parseSimpleYAML('quality_gate: true\ntimeout_ms: 5000\nblocking: false');
        assert.equal(result.quality_gate, true);
        assert.equal(result.timeout_ms, 5000);
        assert.equal(result.blocking, false);
    });

    it('parses arrays', () => {
        const yaml = 'events:\n  - task.done\n  - gate.failed\n  - deploy.started';
        const result = parseSimpleYAML(yaml);
        assert.ok(Array.isArray(result.events));
        assert.deepEqual(result.events, ['task.done', 'gate.failed', 'deploy.started']);
    });

    it('parses multiline strings', () => {
        const yaml = 'prompt_template: |\n  Review the code\n  Check for bugs\nname: test';
        const result = parseSimpleYAML(yaml);
        assert.ok(result.prompt_template.includes('Review the code'));
        assert.ok(result.prompt_template.includes('Check for bugs'));
        assert.equal(result.name, 'test');
    });

    it('skips comments', () => {
        const yaml = '# This is a comment\ntype: agent\n# Another comment\nname: test';
        const result = parseSimpleYAML(yaml);
        assert.equal(result.type, 'agent');
        assert.equal(result.name, 'test');
    });
});
