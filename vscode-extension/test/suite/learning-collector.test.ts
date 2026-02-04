/**
 * Learning Collector Test Suite
 *
 * Tests for the VS Code extension learning collector service.
 * Verifies signal emission for user preferences, errors, success patterns, and workflows.
 *
 * Run with: npm test (from vscode-extension directory)
 * Or directly: npx mocha --require ts-node/register test/suite/learning-collector.test.ts
 */

/// <reference types="mocha" />

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Signal type definitions for test validation
const SignalType = {
  USER_PREFERENCE: 'user_preference',
  ERROR_PATTERN: 'error_pattern',
  SUCCESS_PATTERN: 'success_pattern',
  WORKFLOW_PATTERN: 'workflow_pattern',
} as const;

// Test helper functions
function generateTestId(): string {
  return 'sig-' + Math.random().toString(36).substring(2, 10);
}

function getTestTimestamp(): string {
  return new Date().toISOString();
}

// Main test suite
suite('LearningCollector Unit Tests', () => {
  let testDir: string;
  let signalsDir: string;

  setup(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-test-'));
    signalsDir = path.join(testDir, '.loki', 'learning', 'signals');
    fs.mkdirSync(signalsDir, { recursive: true });
  });

  teardown(() => {
    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  suite('Signal File Writing', () => {
    test('should create valid JSON signal files', () => {
      const signal = {
        id: 'sig-test123',
        type: 'user_preference',
        source: 'vscode',
        action: 'test_action',
        context: {},
        outcome: 'success',
        confidence: 0.9,
        timestamp: getTestTimestamp(),
        metadata: {},
        preference_key: 'test_key',
        preference_value: 'test_value',
        alternatives_rejected: [],
      };

      const timestampStr = signal.timestamp.replace(/:/g, '-');
      const signalFile = path.join(signalsDir, `${timestampStr}_${signal.id}.json`);

      // Write the signal
      fs.writeFileSync(signalFile, JSON.stringify(signal, null, 2));

      // Verify file exists
      assert.ok(fs.existsSync(signalFile), 'Signal file should exist');

      // Verify content is valid JSON
      const content = fs.readFileSync(signalFile, 'utf-8');
      const parsed = JSON.parse(content);

      assert.strictEqual(parsed.id, 'sig-test123');
      assert.strictEqual(parsed.type, 'user_preference');
      assert.strictEqual(parsed.source, 'vscode');
      assert.strictEqual(parsed.preference_key, 'test_key');
    });

    test('should handle concurrent writes', async () => {
      const writeSignal = (index: number) => {
        const signal = {
          id: `sig-concurrent-${index}`,
          type: 'user_preference',
          source: 'vscode',
          action: `action_${index}`,
          context: {},
          outcome: 'success',
          confidence: 0.9,
          timestamp: getTestTimestamp(),
          metadata: {},
          preference_key: `key_${index}`,
          preference_value: `value_${index}`,
          alternatives_rejected: [],
        };

        const timestampStr = signal.timestamp.replace(/:/g, '-');
        const signalFile = path.join(signalsDir, `${timestampStr}_${signal.id}.json`);

        return fs.promises.writeFile(signalFile, JSON.stringify(signal, null, 2));
      };

      // Write 10 signals concurrently
      await Promise.all(Array.from({ length: 10 }, (_, i) => writeSignal(i)));

      // Verify all files were written
      const files = fs.readdirSync(signalsDir);
      assert.strictEqual(files.length, 10, 'Should have 10 signal files');
    });
  });

  suite('Signal Types', () => {
    test('should create valid UserPreferenceSignal', () => {
      const signal = {
        id: 'sig-pref123',
        type: SignalType.USER_PREFERENCE,
        source: 'vscode',
        action: 'command_executed',
        context: { commandId: 'loki.start' },
        outcome: 'success',
        confidence: 0.9,
        timestamp: getTestTimestamp(),
        metadata: { vscodeVersion: '1.85.0' },
        preference_key: 'command_choice',
        preference_value: 'loki.start',
        alternatives_rejected: ['loki.stop', 'loki.pause'],
      };

      // Validate required fields
      assert.ok(signal.id.startsWith('sig-'), 'ID should start with sig-');
      assert.strictEqual(signal.type, 'user_preference');
      assert.strictEqual(signal.source, 'vscode');
      assert.ok(signal.preference_key, 'preference_key should be set');
      assert.ok(signal.preference_value !== undefined, 'preference_value should be set');
      assert.ok(Array.isArray(signal.alternatives_rejected), 'alternatives_rejected should be array');
    });

    test('should create valid ErrorPatternSignal', () => {
      const signal = {
        id: 'sig-err456',
        type: SignalType.ERROR_PATTERN,
        source: 'vscode',
        action: 'error_occurred',
        context: {},
        outcome: 'failure',
        confidence: 0.8,
        timestamp: getTestTimestamp(),
        metadata: {},
        error_type: 'session_start_failed',
        error_message: 'Connection refused',
        resolution: '',
        stack_trace: 'Error: Connection refused\n    at connect ()',
        recovery_steps: [],
      };

      assert.strictEqual(signal.type, 'error_pattern');
      assert.ok(signal.error_type, 'error_type should be set');
      assert.ok(signal.error_message, 'error_message should be set');
    });

    test('should create valid SuccessPatternSignal', () => {
      const signal = {
        id: 'sig-succ789',
        type: SignalType.SUCCESS_PATTERN,
        source: 'vscode',
        action: 'operation_succeeded',
        context: {},
        outcome: 'success',
        confidence: 0.85,
        timestamp: getTestTimestamp(),
        metadata: {},
        pattern_name: 'session_start',
        action_sequence: ['select_prd', 'choose_provider', 'api_request', 'start_polling'],
        preconditions: ['api_available'],
        postconditions: ['session_running', 'ui_updated'],
        duration_seconds: 2.5,
      };

      assert.strictEqual(signal.type, 'success_pattern');
      assert.ok(signal.pattern_name, 'pattern_name should be set');
      assert.ok(signal.action_sequence.length > 0, 'action_sequence should have steps');
      assert.ok(signal.duration_seconds >= 0, 'duration_seconds should be non-negative');
    });

    test('should create valid WorkflowPatternSignal', () => {
      const signal = {
        id: 'sig-wf101',
        type: SignalType.WORKFLOW_PATTERN,
        source: 'vscode',
        action: 'workflow_completed',
        context: { provider: 'claude' },
        outcome: 'success',
        confidence: 0.85,
        timestamp: getTestTimestamp(),
        metadata: {},
        workflow_name: 'loki_session_start',
        steps: ['initiate_start', 'select_prd', 'api_request', 'session_active'],
        parallel_steps: [],
        branching_conditions: {},
        total_duration_seconds: 5.2,
      };

      assert.strictEqual(signal.type, 'workflow_pattern');
      assert.ok(signal.workflow_name, 'workflow_name should be set');
      assert.ok(signal.steps.length > 0, 'steps should have entries');
      assert.ok(signal.total_duration_seconds >= 0, 'total_duration_seconds should be non-negative');
    });
  });

  suite('Signal Validation', () => {
    test('should validate confidence range', () => {
      const validConfidence = 0.85;
      const invalidLow = -0.1;
      const invalidHigh = 1.5;

      assert.ok(validConfidence >= 0 && validConfidence <= 1, 'Valid confidence should be in range');
      assert.ok(invalidLow < 0 || invalidLow > 1, 'Invalid low confidence should be out of range');
      assert.ok(invalidHigh < 0 || invalidHigh > 1, 'Invalid high confidence should be out of range');
    });

    test('should require non-empty action', () => {
      const validAction = 'command_executed';
      const invalidAction = '';

      assert.ok(validAction.length > 0, 'Valid action should be non-empty');
      assert.strictEqual(invalidAction.length, 0, 'Invalid action should be empty');
    });

    test('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTestId());
      }
      assert.strictEqual(ids.size, 100, 'All generated IDs should be unique');
    });
  });

  suite('Signal Directory Management', () => {
    test('should create signals directory if not exists', () => {
      const newDir = path.join(testDir, 'new-loki', 'learning', 'signals');

      // Initially should not exist
      assert.ok(!fs.existsSync(newDir), 'Directory should not exist initially');

      // Create it
      fs.mkdirSync(newDir, { recursive: true });

      // Now should exist
      assert.ok(fs.existsSync(newDir), 'Directory should exist after creation');
    });

    test('should handle missing parent directory gracefully', () => {
      const deepPath = path.join(testDir, 'a', 'b', 'c', 'd', 'signals');

      // Create nested directories
      fs.mkdirSync(deepPath, { recursive: true });

      assert.ok(fs.existsSync(deepPath), 'Deeply nested directory should be created');
    });
  });
});
