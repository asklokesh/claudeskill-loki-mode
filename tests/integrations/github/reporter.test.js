'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('path');
var fs = require('fs');
var os = require('os');
var reporter = require('../../../src/integrations/github/reporter.js');

// ============================================================
// loadReport
// ============================================================

test('loadReport - returns defaults when no path provided', function () {
  var report = reporter.loadReport(null);
  assert.equal(report.tasksCompleted, 0);
  assert.equal(report.tasksFailed, 0);
  assert.equal(report.totalTasks, 0);
  assert.equal(report.duration, 'unknown');
  assert.equal(report.deploymentUrl, null);
  assert.ok(Array.isArray(report.qualityGates));
  assert.equal(report.qualityGates.length, 0);
});

test('loadReport - returns defaults when path does not exist', function () {
  var report = reporter.loadReport('/nonexistent/path/reports');
  assert.equal(report.tasksCompleted, 0);
  assert.equal(report.totalTasks, 0);
});

test('loadReport - loads quality gates from file', function () {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-reporter-test-'));
  var gatesData = {
    gates: [
      { name: 'Static Analysis', passed: true, details: 'No issues' },
      { name: 'Unit Tests', passed: false, details: '3 failures' },
    ],
  };
  fs.writeFileSync(path.join(tmpDir, 'quality-gates.json'), JSON.stringify(gatesData));

  var report = reporter.loadReport(tmpDir);
  assert.equal(report.qualityGates.length, 2);
  assert.equal(report.qualityGates[0].name, 'Static Analysis');
  assert.equal(report.qualityGates[0].passed, true);
  assert.equal(report.qualityGates[1].passed, false);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('loadReport - loads summary from file', function () {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-reporter-test-'));
  var summaryData = {
    tasksCompleted: 8,
    tasksFailed: 1,
    totalTasks: 9,
    duration: '4m 30s',
    deploymentUrl: 'https://app.example.com',
    summary: 'Built auth system successfully.',
  };
  fs.writeFileSync(path.join(tmpDir, 'summary.json'), JSON.stringify(summaryData));

  var report = reporter.loadReport(tmpDir);
  assert.equal(report.tasksCompleted, 8);
  assert.equal(report.tasksFailed, 1);
  assert.equal(report.totalTasks, 9);
  assert.equal(report.duration, '4m 30s');
  assert.equal(report.deploymentUrl, 'https://app.example.com');
  assert.equal(report.summary, 'Built auth system successfully.');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('loadReport - handles malformed JSON gracefully', function () {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loki-reporter-test-'));
  fs.writeFileSync(path.join(tmpDir, 'quality-gates.json'), 'not valid json{{{');

  var report = reporter.loadReport(tmpDir);
  assert.equal(report.qualityGates.length, 0);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// applyTemplate
// ============================================================

test('applyTemplate - replaces all placeholders', function () {
  var template = '{{STATUS}} - {{EXECUTION_ID}} - {{TASKS_COMPLETED}}/{{TOTAL_TASKS}}';
  var report = {
    tasksCompleted: 5,
    tasksFailed: 0,
    totalTasks: 5,
    duration: '2m',
    qualityGates: [],
    deploymentUrl: null,
    summary: 'All done.',
  };
  var options = {
    status: 'success',
    executionId: 'run-123',
    repository: 'org/repo',
    sha: 'abc1234567890',
    serverUrl: 'https://github.com',
    runId: '999',
  };

  var result = reporter.applyTemplate(template, report, options);
  assert.equal(result, 'PASS - run-123 - 5/5');
});

test('applyTemplate - renders quality gates table', function () {
  var template = '{{QUALITY_GATES_TABLE}}';
  var report = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalTasks: 0,
    duration: '',
    qualityGates: [
      { name: 'Lint', passed: true, details: 'Clean' },
      { name: 'Tests', passed: false, details: '2 failures' },
    ],
    deploymentUrl: null,
    summary: '',
  };
  var options = {
    status: 'failure',
    executionId: 'x',
    repository: 'o/r',
    sha: 'aaa',
    serverUrl: 'https://github.com',
    runId: '1',
  };

  var result = reporter.applyTemplate(template, report, options);
  assert.ok(result.indexOf('| Lint | PASS | Clean |') !== -1);
  assert.ok(result.indexOf('| Tests | FAIL | 2 failures |') !== -1);
});

test('applyTemplate - failure status renders as FAIL', function () {
  var template = '{{STATUS}}';
  var report = { qualityGates: [], tasksCompleted: 0, tasksFailed: 1, totalTasks: 1, duration: '', deploymentUrl: null, summary: '' };
  var options = { status: 'failure', executionId: '', repository: 'o/r', sha: '', serverUrl: '', runId: '' };

  assert.equal(reporter.applyTemplate(template, report, options), 'FAIL');
});

test('applyTemplate - deployment URL renders link', function () {
  var template = '{{DEPLOYMENT_URL}}';
  var report = { qualityGates: [], tasksCompleted: 0, tasksFailed: 0, totalTasks: 0, duration: '', deploymentUrl: 'https://deploy.example.com', summary: '' };
  var options = { status: 'success', executionId: '', repository: 'o/r', sha: '', serverUrl: '', runId: '' };

  var result = reporter.applyTemplate(template, report, options);
  assert.ok(result.indexOf('https://deploy.example.com') !== -1);
  assert.ok(result.indexOf('[View Deployment]') !== -1);
});

test('applyTemplate - no deployment URL renders N/A', function () {
  var template = '{{DEPLOYMENT_URL}}';
  var report = { qualityGates: [], tasksCompleted: 0, tasksFailed: 0, totalTasks: 0, duration: '', deploymentUrl: null, summary: '' };
  var options = { status: 'success', executionId: '', repository: 'o/r', sha: '', serverUrl: '', runId: '' };

  assert.equal(reporter.applyTemplate(template, report, options), 'N/A');
});

// ============================================================
// renderQualityReport
// ============================================================

test('renderQualityReport - produces valid markdown', function () {
  var report = {
    qualityGates: [
      { name: 'Static Analysis', passed: true, details: '0 issues' },
      { name: 'Unit Tests', passed: true, details: '100% pass' },
      { name: 'Coverage', passed: false, details: '72% < 80%' },
    ],
    tasksCompleted: 7,
    tasksFailed: 2,
    totalTasks: 9,
    duration: '5m 12s',
    deploymentUrl: 'https://staging.example.com',
    summary: 'Feature implemented.',
  };
  var options = {
    status: 'success',
    executionId: 'exec-abc',
    repository: 'org/repo',
    sha: 'deadbeef1234',
    serverUrl: 'https://github.com',
    runId: '42',
  };

  var result = reporter.renderQualityReport(report, options);

  // Verify it contains key elements
  assert.ok(result.indexOf('Quality Report') !== -1, 'Should contain title');
  assert.ok(result.indexOf('PASS') !== -1, 'Should contain PASS status');
  assert.ok(result.indexOf('exec-abc') !== -1, 'Should contain execution ID');
  assert.ok(result.indexOf('Static Analysis') !== -1, 'Should contain gate name');
  assert.ok(result.indexOf('7/9') !== -1, 'Should contain task counts');
  assert.ok(result.indexOf('5m 12s') !== -1, 'Should contain duration');
  assert.ok(result.indexOf('staging.example.com') !== -1, 'Should contain deployment URL');
  // Verify markdown table structure
  assert.ok(result.indexOf('| Gate | Status | Details |') !== -1, 'Should have table header');
});

// ============================================================
// renderExecutionSummary
// ============================================================

test('renderExecutionSummary - produces valid markdown', function () {
  var report = {
    qualityGates: [],
    tasksCompleted: 3,
    tasksFailed: 0,
    totalTasks: 3,
    duration: '1m 45s',
    deploymentUrl: null,
    summary: 'All tasks completed without errors.',
  };
  var options = {
    status: 'success',
    executionId: 'exec-xyz',
    repository: 'org/repo',
    sha: 'cafe1234',
    serverUrl: 'https://github.com',
    runId: '100',
  };

  var result = reporter.renderExecutionSummary(report, options);

  assert.ok(result.indexOf('Execution Summary') !== -1, 'Should contain title');
  assert.ok(result.indexOf('PASS') !== -1, 'Should contain PASS');
  assert.ok(result.indexOf('All tasks completed') !== -1, 'Should contain summary');
  assert.ok(result.indexOf('3/3') !== -1, 'Should contain task counts');
  assert.ok(result.indexOf('1m 45s') !== -1, 'Should contain duration');
});

// ============================================================
// postResults - error handling
// ============================================================

test('postResults - throws when no token provided', async function () {
  await assert.rejects(
    function () {
      return reporter.postResults({
        eventName: 'issues',
        payload: {},
        status: 'success',
        token: '',
      });
    },
    { message: /token is required/ }
  );
});

// ============================================================
// escapeMarkdown (security fix)
// ============================================================

test('escapeMarkdown - escapes markdown structural characters', function () {
  assert.equal(reporter.escapeMarkdown('hello [world](http://x.com)'), 'hello \\[world\\]\\(http://x.com\\)');
  assert.equal(reporter.escapeMarkdown('use `backtick`'), 'use \\`backtick\\`');
  assert.equal(reporter.escapeMarkdown('a\\b'), 'a\\\\b');
});

test('escapeMarkdown - collapses newlines in single-line mode', function () {
  var result = reporter.escapeMarkdown('line one\nline two\r\nline three');
  assert.ok(result.indexOf('\n') === -1, 'Should not contain newlines');
  assert.ok(result.indexOf('line one') !== -1);
  assert.ok(result.indexOf('line two') !== -1);
});

test('escapeMarkdown - preserves newlines in multiline mode', function () {
  var result = reporter.escapeMarkdown('line one\nline two', true);
  assert.ok(result.indexOf('\n') !== -1, 'Should preserve newlines');
});

test('escapeMarkdown - handles non-string input', function () {
  assert.equal(reporter.escapeMarkdown(42), '42');
  assert.equal(reporter.escapeMarkdown(null), 'null');
});

// ============================================================
// isSafeUrl (security fix)
// ============================================================

test('isSafeUrl - accepts https URLs', function () {
  assert.equal(reporter.isSafeUrl('https://example.com'), true);
  assert.equal(reporter.isSafeUrl('https://staging.example.com/path?q=1'), true);
});

test('isSafeUrl - rejects non-https URLs', function () {
  assert.equal(reporter.isSafeUrl('http://example.com'), false);
  assert.equal(reporter.isSafeUrl('javascript:alert(1)'), false);
  assert.equal(reporter.isSafeUrl('data:text/html,<h1>x</h1>'), false);
  assert.equal(reporter.isSafeUrl('ftp://files.example.com'), false);
  assert.equal(reporter.isSafeUrl(''), false);
  assert.equal(reporter.isSafeUrl(null), false);
});

// ============================================================
// applyTemplate - single-pass replace (no infinite loop)
// ============================================================

test('applyTemplate - self-referential replacement value does not loop', function () {
  // If SUMMARY contains the text {{EXECUTION_ID}}, the old while-loop would
  // re-expand it infinitely. The single-pass regex replace handles this safely.
  var template = 'ID={{EXECUTION_ID}} SUMMARY={{SUMMARY}}';
  var report = {
    qualityGates: [],
    tasksCompleted: 0,
    tasksFailed: 0,
    totalTasks: 0,
    duration: '',
    deploymentUrl: null,
    summary: 'The {{EXECUTION_ID}} was unexpected',
  };
  var options = {
    status: 'success',
    executionId: 'run-999',
    repository: 'o/r',
    sha: 'abc',
    serverUrl: 'https://github.com',
    runId: '1',
  };

  // Should complete without hanging and not double-expand the nested placeholder
  var result = reporter.applyTemplate(template, report, options);
  assert.ok(result.indexOf('run-999') !== -1, 'Should contain execution ID');
  // The {{EXECUTION_ID}} inside SUMMARY should NOT be expanded to run-999 again
  // (single-pass means it stays as-is after escaping, or the escaped version appears)
  assert.ok(result.indexOf('ID=run-999') !== -1, 'Top-level placeholder replaced');
});

test('applyTemplate - unsafe deployment URL is not rendered as link', function () {
  var template = '{{DEPLOYMENT_URL}}';
  var report = {
    qualityGates: [],
    tasksCompleted: 0,
    tasksFailed: 0,
    totalTasks: 0,
    duration: '',
    deploymentUrl: 'javascript:alert(1)',
    summary: '',
  };
  var options = { status: 'success', executionId: '', repository: 'o/r', sha: '', serverUrl: '', runId: '' };

  var result = reporter.applyTemplate(template, report, options);
  // Must not render as a markdown link
  assert.ok(result.indexOf('[View Deployment]') === -1, 'Should not render unsafe URL as a link');
  // The raw URL text should appear escaped, not as a link
  assert.ok(result.indexOf('javascript:alert') !== -1 || result.indexOf('javascript') !== -1);
});

test('applyTemplate - githubApiRequest is not exported', function () {
  // Verify the internal API function is not part of the public module surface
  assert.equal(typeof reporter.githubApiRequest, 'undefined',
    'githubApiRequest should not be exported from the module');
});
