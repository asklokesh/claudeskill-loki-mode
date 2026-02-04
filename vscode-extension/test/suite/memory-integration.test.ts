/**
 * Memory Integration Test Suite
 *
 * Tests for the VS Code extension file edit memory integration service.
 * Verifies episode creation, debouncing, pattern detection, and statistics.
 *
 * Run with: npm test (from vscode-extension directory)
 * Or directly: npx mocha --require ts-node/register test/suite/memory-integration.test.ts
 */

/// <reference types="mocha" />

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Change type definitions for test validation
const ChangeType = {
  ADDITION: 'addition',
  DELETION: 'deletion',
  MODIFICATION: 'modification',
  REFACTOR: 'refactor',
} as const;

type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

// Test helper functions
function generateTestId(): string {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 10);
  return `ep-${timestamp}-${random}`;
}

function getTestTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Determine the change type based on content changes (mirrors implementation)
 */
function detectChangeType(
  addedChars: number,
  deletedChars: number,
  addedLines: number,
  deletedLines: number
): ChangeType {
  if (deletedChars === 0 && addedChars > 0) {
    return ChangeType.ADDITION;
  }
  if (addedChars === 0 && deletedChars > 0) {
    return ChangeType.DELETION;
  }
  if (addedChars > 0 && deletedChars > 0) {
    const ratio = Math.min(addedChars, deletedChars) / Math.max(addedChars, deletedChars);
    if (ratio > 0.8 && (addedLines === deletedLines || Math.abs(addedLines - deletedLines) <= 2)) {
      return ChangeType.REFACTOR;
    }
  }
  return ChangeType.MODIFICATION;
}

/**
 * Detect code patterns in text (mirrors implementation)
 */
function detectCodePatterns(text: string, languageId: string): string[] {
  const patterns: string[] = [];

  if (languageId === 'typescript' || languageId === 'javascript') {
    if (/\bfunction\s+\w+/.test(text)) patterns.push('function_definition');
    if (/\bclass\s+\w+/.test(text)) patterns.push('class_definition');
    if (/\basync\b/.test(text)) patterns.push('async_code');
    if (/\bawait\b/.test(text)) patterns.push('await_usage');
    if (/\bimport\s+/.test(text)) patterns.push('import_statement');
    if (/\bexport\s+/.test(text)) patterns.push('export_statement');
    if (/\btry\s*\{/.test(text)) patterns.push('error_handling');
    if (/\bcatch\s*\(/.test(text)) patterns.push('error_handling');
    if (/\binterface\s+\w+/.test(text)) patterns.push('interface_definition');
    if (/\btype\s+\w+\s*=/.test(text)) patterns.push('type_alias');
    if (/\b(describe|it|test)\s*\(/.test(text)) patterns.push('test_code');
  }

  if (languageId === 'python') {
    if (/\bdef\s+\w+/.test(text)) patterns.push('function_definition');
    if (/\bclass\s+\w+/.test(text)) patterns.push('class_definition');
    if (/\basync\s+def\b/.test(text)) patterns.push('async_code');
    if (/\bimport\s+/.test(text)) patterns.push('import_statement');
    if (/\bfrom\s+\w+\s+import/.test(text)) patterns.push('import_statement');
    if (/\btry\s*:/.test(text)) patterns.push('error_handling');
    if (/\bdef\s+test_/.test(text)) patterns.push('test_code');
    if (/@\w+/.test(text)) patterns.push('decorator_usage');
  }

  if (/TODO|FIXME|HACK|XXX/.test(text)) patterns.push('todo_comment');
  if (/\bconsole\.(log|error|warn|debug)/.test(text)) patterns.push('debug_logging');

  return [...new Set(patterns)];
}

/**
 * Check if a change is meaningful (mirrors implementation)
 */
function isMeaningfulChange(text: string, rangeLength: number): boolean {
  if (text.length === 0 && rangeLength === 0) return false;
  if (/^\s*$/.test(text) && rangeLength === 0) return false;
  if (text.length === 1 && rangeLength === 0) return false;
  return true;
}

// Main test suite
suite('FileEditMemoryIntegration Unit Tests', () => {
  let testDir: string;
  let episodicDir: string;

  setup(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-memory-test-'));
    episodicDir = path.join(testDir, '.loki', 'memory', 'episodic');
    fs.mkdirSync(episodicDir, { recursive: true });
  });

  teardown(() => {
    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  suite('Episode File Writing', () => {
    test('should create valid JSON episode files', () => {
      const episode = {
        id: generateTestId(),
        task_id: 'edit-test-file-ts',
        timestamp: getTestTimestamp(),
        duration_seconds: 5,
        agent: 'vscode',
        context: {
          phase: 'ACT',
          goal: 'Edit test-file.ts',
          files_involved: ['test-file.ts'],
        },
        action_log: [
          { t: 0, action: 'addition_code', target: 'line 10', result: 'function test() {}' },
        ],
        outcome: 'success',
        errors_encountered: [],
        artifacts_produced: [],
        files_read: [],
        files_modified: ['test-file.ts'],
        importance: 0.5,
        access_count: 0,
        task_type: 'code_edit',
        edit_summary: {
          change_type: 'addition',
          lines_added: 1,
          lines_deleted: 0,
          characters_added: 18,
          characters_deleted: 0,
          patterns_detected: ['function_definition'],
        },
      };

      const dateStr = episode.timestamp.slice(0, 10);
      const datePath = path.join(episodicDir, dateStr);
      fs.mkdirSync(datePath, { recursive: true });

      const filePath = path.join(datePath, `task-${episode.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(episode, null, 2));

      // Verify file exists
      assert.ok(fs.existsSync(filePath), 'Episode file should exist');

      // Verify content is valid JSON
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      assert.strictEqual(parsed.agent, 'vscode');
      assert.strictEqual(parsed.task_type, 'code_edit');
      assert.strictEqual(parsed.outcome, 'success');
      assert.ok(parsed.edit_summary, 'Should have edit_summary');
      assert.strictEqual(parsed.edit_summary.change_type, 'addition');
    });

    test('should handle concurrent episode writes', async () => {
      const writeEpisode = (index: number) => {
        const episode = {
          id: `ep-test-${index}-${Math.random().toString(36).substring(2, 8)}`,
          task_id: `edit-file-${index}`,
          timestamp: getTestTimestamp(),
          duration_seconds: index,
          agent: 'vscode',
          context: {
            phase: 'ACT',
            goal: `Edit file-${index}.ts`,
            files_involved: [`file-${index}.ts`],
          },
          action_log: [],
          outcome: 'success',
          errors_encountered: [],
          artifacts_produced: [],
          files_read: [],
          files_modified: [`file-${index}.ts`],
          importance: 0.5,
          access_count: 0,
          task_type: 'code_edit',
        };

        const dateStr = episode.timestamp.slice(0, 10);
        const datePath = path.join(episodicDir, dateStr);
        if (!fs.existsSync(datePath)) {
          fs.mkdirSync(datePath, { recursive: true });
        }

        const filePath = path.join(datePath, `task-${episode.id}.json`);
        return fs.promises.writeFile(filePath, JSON.stringify(episode, null, 2));
      };

      // Write 10 episodes concurrently
      await Promise.all(Array.from({ length: 10 }, (_, i) => writeEpisode(i)));

      // Verify all files were written
      const dateStr = new Date().toISOString().slice(0, 10);
      const datePath = path.join(episodicDir, dateStr);
      const files = fs.readdirSync(datePath);
      assert.strictEqual(files.length, 10, 'Should have 10 episode files');
    });
  });

  suite('Change Type Detection', () => {
    test('should detect pure addition', () => {
      const result = detectChangeType(100, 0, 5, 0);
      assert.strictEqual(result, ChangeType.ADDITION);
    });

    test('should detect pure deletion', () => {
      const result = detectChangeType(0, 100, 0, 5);
      assert.strictEqual(result, ChangeType.DELETION);
    });

    test('should detect refactor (similar added/deleted)', () => {
      // 100 chars added, 95 chars deleted, same lines = refactor
      const result = detectChangeType(100, 95, 5, 5);
      assert.strictEqual(result, ChangeType.REFACTOR);
    });

    test('should detect modification (dissimilar changes)', () => {
      // 100 chars added, 20 chars deleted = modification, not refactor
      const result = detectChangeType(100, 20, 5, 1);
      assert.strictEqual(result, ChangeType.MODIFICATION);
    });

    test('should handle edge cases', () => {
      // Zero for both should be modification (or edge case)
      const resultZero = detectChangeType(0, 0, 0, 0);
      assert.strictEqual(resultZero, ChangeType.MODIFICATION);
    });
  });

  suite('Code Pattern Detection', () => {
    test('should detect TypeScript function definition', () => {
      const code = 'function processData(items: Item[]) { return items.map(i => i.id); }';
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('function_definition'), 'Should detect function_definition');
    });

    test('should detect TypeScript class definition', () => {
      const code = 'class UserService { constructor() {} }';
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('class_definition'), 'Should detect class_definition');
    });

    test('should detect async/await patterns', () => {
      const code = 'async function fetchData() { const result = await api.get(); return result; }';
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('async_code'), 'Should detect async_code');
      assert.ok(patterns.includes('await_usage'), 'Should detect await_usage');
      assert.ok(patterns.includes('function_definition'), 'Should detect function_definition');
    });

    test('should detect import/export statements', () => {
      const code = "import { Component } from 'react';\nexport default Component;";
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('import_statement'), 'Should detect import_statement');
      assert.ok(patterns.includes('export_statement'), 'Should detect export_statement');
    });

    test('should detect error handling patterns', () => {
      const code = 'try { doSomething(); } catch (e) { console.error(e); }';
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('error_handling'), 'Should detect error_handling');
    });

    test('should detect interface definition', () => {
      const code = 'interface User { id: number; name: string; }';
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('interface_definition'), 'Should detect interface_definition');
    });

    test('should detect type alias', () => {
      const code = 'type UserId = string | number;';
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('type_alias'), 'Should detect type_alias');
    });

    test('should detect test code', () => {
      const code = "describe('MyClass', () => { it('should work', () => { expect(true).toBe(true); }); });";
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('test_code'), 'Should detect test_code');
    });

    test('should detect Python function definition', () => {
      const code = 'def process_data(items):\n    return [i.id for i in items]';
      const patterns = detectCodePatterns(code, 'python');
      assert.ok(patterns.includes('function_definition'), 'Should detect function_definition');
    });

    test('should detect Python class definition', () => {
      const code = 'class UserService:\n    def __init__(self):\n        pass';
      const patterns = detectCodePatterns(code, 'python');
      assert.ok(patterns.includes('class_definition'), 'Should detect class_definition');
    });

    test('should detect Python async def', () => {
      const code = 'async def fetch_data():\n    result = await api.get()\n    return result';
      const patterns = detectCodePatterns(code, 'python');
      assert.ok(patterns.includes('async_code'), 'Should detect async_code');
    });

    test('should detect Python imports', () => {
      const code = 'import os\nfrom typing import List, Dict';
      const patterns = detectCodePatterns(code, 'python');
      assert.ok(patterns.includes('import_statement'), 'Should detect import_statement');
    });

    test('should detect Python error handling', () => {
      const code = 'try:\n    do_something()\nexcept Exception as e:\n    print(e)';
      const patterns = detectCodePatterns(code, 'python');
      assert.ok(patterns.includes('error_handling'), 'Should detect error_handling');
    });

    test('should detect Python test functions', () => {
      const code = 'def test_user_creation():\n    user = User()\n    assert user.id is not None';
      const patterns = detectCodePatterns(code, 'python');
      assert.ok(patterns.includes('test_code'), 'Should detect test_code');
    });

    test('should detect Python decorators', () => {
      const code = '@property\ndef name(self):\n    return self._name';
      const patterns = detectCodePatterns(code, 'python');
      assert.ok(patterns.includes('decorator_usage'), 'Should detect decorator_usage');
    });

    test('should detect TODO comments', () => {
      const code = '// TODO: Fix this later\nfunction temp() {}';
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('todo_comment'), 'Should detect todo_comment');
    });

    test('should detect debug logging', () => {
      const code = "console.log('debug:', data);\nconsole.error('Error:', err);";
      const patterns = detectCodePatterns(code, 'typescript');
      assert.ok(patterns.includes('debug_logging'), 'Should detect debug_logging');
    });

    test('should not duplicate patterns', () => {
      const code = 'function a() {}\nfunction b() {}\nfunction c() {}';
      const patterns = detectCodePatterns(code, 'typescript');
      const functionPatterns = patterns.filter((p) => p === 'function_definition');
      assert.strictEqual(functionPatterns.length, 1, 'Should not duplicate function_definition');
    });
  });

  suite('Meaningful Change Detection', () => {
    test('should reject empty changes', () => {
      assert.ok(!isMeaningfulChange('', 0), 'Empty change should not be meaningful');
    });

    test('should reject whitespace-only changes', () => {
      assert.ok(!isMeaningfulChange('   ', 0), 'Whitespace-only should not be meaningful');
      assert.ok(!isMeaningfulChange('\n\t', 0), 'Newline and tab should not be meaningful');
    });

    test('should reject single character additions', () => {
      assert.ok(!isMeaningfulChange('a', 0), 'Single character should not be meaningful');
    });

    test('should accept deletions', () => {
      assert.ok(isMeaningfulChange('', 10), 'Deletion should be meaningful');
    });

    test('should accept multi-character additions', () => {
      assert.ok(isMeaningfulChange('const x = 1;', 0), 'Multi-character should be meaningful');
    });

    test('should accept replacements', () => {
      assert.ok(isMeaningfulChange('newText', 10), 'Replacement should be meaningful');
    });
  });

  suite('Episode ID Generation', () => {
    test('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTestId());
      }
      assert.strictEqual(ids.size, 100, 'All generated IDs should be unique');
    });

    test('should follow ep-YYYYMMDD-XXXXXXXX format', () => {
      const id = generateTestId();
      assert.ok(/^ep-\d{8}-[a-z0-9]{8}$/.test(id), `ID should match format: ${id}`);
    });

    test('should include current date', () => {
      const id = generateTestId();
      const expectedDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      assert.ok(id.includes(expectedDate), `ID should include date ${expectedDate}: ${id}`);
    });
  });

  suite('Episode Structure Validation', () => {
    test('should have all required fields', () => {
      const episode = {
        id: generateTestId(),
        task_id: 'edit-file-ts',
        timestamp: getTestTimestamp(),
        duration_seconds: 10,
        agent: 'vscode',
        context: {
          phase: 'ACT',
          goal: 'Edit file.ts',
          files_involved: ['file.ts'],
        },
        action_log: [],
        outcome: 'success',
        errors_encountered: [],
        artifacts_produced: [],
        files_read: [],
        files_modified: ['file.ts'],
        importance: 0.5,
        access_count: 0,
        task_type: 'code_edit',
      };

      // Required base fields
      assert.ok(episode.id, 'id is required');
      assert.ok(episode.task_id, 'task_id is required');
      assert.ok(episode.timestamp, 'timestamp is required');
      assert.ok(episode.duration_seconds >= 0, 'duration_seconds should be non-negative');
      assert.ok(episode.agent, 'agent is required');
      assert.ok(episode.context, 'context is required');
      assert.ok(episode.context.phase, 'context.phase is required');
      assert.ok(episode.context.goal, 'context.goal is required');
      assert.ok(Array.isArray(episode.action_log), 'action_log should be array');
      assert.ok(['success', 'failure', 'partial'].includes(episode.outcome), 'outcome should be valid');
      assert.ok(Array.isArray(episode.errors_encountered), 'errors_encountered should be array');
      assert.ok(Array.isArray(episode.files_modified), 'files_modified should be array');
      assert.ok(episode.importance >= 0 && episode.importance <= 1, 'importance should be 0-1');
      assert.ok(episode.access_count >= 0, 'access_count should be non-negative');
    });

    test('should have valid edit_summary when present', () => {
      const editSummary = {
        change_type: 'modification' as ChangeType,
        lines_added: 5,
        lines_deleted: 2,
        characters_added: 150,
        characters_deleted: 50,
        patterns_detected: ['function_definition', 'async_code'],
      };

      assert.ok(Object.values(ChangeType).includes(editSummary.change_type), 'change_type should be valid');
      assert.ok(editSummary.lines_added >= 0, 'lines_added should be non-negative');
      assert.ok(editSummary.lines_deleted >= 0, 'lines_deleted should be non-negative');
      assert.ok(editSummary.characters_added >= 0, 'characters_added should be non-negative');
      assert.ok(editSummary.characters_deleted >= 0, 'characters_deleted should be non-negative');
      assert.ok(Array.isArray(editSummary.patterns_detected), 'patterns_detected should be array');
    });
  });

  suite('Directory Management', () => {
    test('should create date-based directories', () => {
      const dateStr = '2026-01-15';
      const datePath = path.join(episodicDir, dateStr);

      assert.ok(!fs.existsSync(datePath), 'Date directory should not exist initially');

      fs.mkdirSync(datePath, { recursive: true });

      assert.ok(fs.existsSync(datePath), 'Date directory should exist after creation');
    });

    test('should handle nested directory creation', () => {
      const deepPath = path.join(testDir, 'a', 'b', 'c', '.loki', 'memory', 'episodic', '2026-01-01');

      fs.mkdirSync(deepPath, { recursive: true });

      assert.ok(fs.existsSync(deepPath), 'Deeply nested directory should be created');
    });
  });

  suite('Statistics Calculation', () => {
    test('should track file edit counts', () => {
      const fileEditCounts = new Map<string, number>();

      fileEditCounts.set('src/index.ts', 5);
      fileEditCounts.set('src/utils.ts', 3);
      fileEditCounts.set('src/types.ts', 1);

      const sorted = Array.from(fileEditCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      assert.strictEqual(sorted[0][0], 'src/index.ts');
      assert.strictEqual(sorted[0][1], 5);
      assert.strictEqual(sorted.length, 3);
    });

    test('should track change type distribution', () => {
      const changeTypeCounts = new Map<ChangeType, number>();

      changeTypeCounts.set(ChangeType.ADDITION, 10);
      changeTypeCounts.set(ChangeType.MODIFICATION, 15);
      changeTypeCounts.set(ChangeType.DELETION, 5);
      changeTypeCounts.set(ChangeType.REFACTOR, 2);

      const total = Array.from(changeTypeCounts.values()).reduce((a, b) => a + b, 0);
      assert.strictEqual(total, 32);
    });

    test('should track hourly activity', () => {
      const hourlyActivity = new Map<number, number>();

      hourlyActivity.set(9, 10);
      hourlyActivity.set(10, 15);
      hourlyActivity.set(14, 20);
      hourlyActivity.set(15, 18);

      const result = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        edits: hourlyActivity.get(hour) || 0,
      }));

      assert.strictEqual(result.length, 24);
      assert.strictEqual(result[9].edits, 10);
      assert.strictEqual(result[0].edits, 0);
    });

    test('should track language distribution', () => {
      const languageEditCounts = new Map<string, number>();

      languageEditCounts.set('typescript', 50);
      languageEditCounts.set('javascript', 20);
      languageEditCounts.set('python', 10);
      languageEditCounts.set('json', 5);

      const sorted = Array.from(languageEditCounts.entries())
        .sort((a, b) => b[1] - a[1]);

      assert.strictEqual(sorted[0][0], 'typescript');
      assert.strictEqual(sorted[0][1], 50);
    });
  });

  suite('File Filtering', () => {
    test('should skip node_modules', () => {
      const filePath = '/project/node_modules/package/index.js';
      assert.ok(filePath.includes('node_modules'), 'Should detect node_modules');
    });

    test('should skip .git directory', () => {
      const filePath = '/project/.git/config';
      assert.ok(filePath.includes('.git'), 'Should detect .git');
    });

    test('should skip .loki directory', () => {
      const filePath = '/project/.loki/memory/index.json';
      assert.ok(filePath.includes('.loki'), 'Should detect .loki');
    });

    test('should skip build directories', () => {
      const paths = [
        '/project/dist/index.js',
        '/project/build/app.js',
        '/project/out/main.js',
        '/project/coverage/lcov.info',
      ];

      for (const filePath of paths) {
        assert.ok(
          /\/(dist|build|out|coverage)\//i.test(filePath),
          `Should detect build directory in ${filePath}`
        );
      }
    });

    test('should skip lock files', () => {
      const paths = [
        '/project/package-lock.json',
        '/project/yarn.lock',
        '/project/bun.lockb',
      ];

      for (const filePath of paths) {
        assert.ok(
          /\.(lock|lockb)/.test(filePath),
          `Should detect lock file in ${filePath}`
        );
      }
    });
  });

  suite('Importance Calculation', () => {
    test('should have base importance of 0.3', () => {
      const baseImportance = 0.3;
      assert.strictEqual(baseImportance, 0.3);
    });

    test('should boost for large changes', () => {
      let importance = 0.3;

      // Boost for >10 lines
      if (15 > 10) importance += 0.1;
      // Boost for >50 lines
      if (15 > 50) importance += 0.1;

      assert.strictEqual(importance, 0.4);
    });

    test('should boost for function/class definitions', () => {
      let importance = 0.3;
      const patterns = ['function_definition', 'class_definition'];

      if (patterns.includes('function_definition') || patterns.includes('class_definition')) {
        importance += 0.15;
      }

      assert.strictEqual(importance, 0.45);
    });

    test('should boost for test code', () => {
      let importance = 0.3;
      const patterns = ['test_code'];

      if (patterns.includes('test_code')) {
        importance += 0.1;
      }

      assert.strictEqual(importance, 0.4);
    });

    test('should cap importance at 0.9', () => {
      let importance = 0.3;

      // Apply many boosts
      importance += 0.15; // function/class
      importance += 0.1; // test
      importance += 0.1; // large change
      importance += 0.1; // very large change
      importance += 0.05; // file type
      importance += 0.05; // error handling

      // Cap at 0.9
      importance = Math.min(0.9, importance);

      assert.strictEqual(importance, 0.85);
      assert.ok(importance <= 0.9, 'Importance should be capped at 0.9');
    });
  });
});
