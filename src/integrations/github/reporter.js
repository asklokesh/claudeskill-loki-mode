'use strict';

/**
 * GitHub Results Reporter
 *
 * Posts Loki Mode execution results back to GitHub as PR comments,
 * issue comments, and status checks. Works both inside GitHub Actions
 * (with GITHUB_TOKEN) and standalone (with configured PAT).
 *
 * Uses only Node.js built-in https module for GitHub REST API calls.
 */

var https = require('https');
var fs = require('fs');
var path = require('path');

/**
 * Post execution results to GitHub based on the trigger event type.
 *
 * @param {Object} options
 * @param {string} options.eventName - GitHub event name
 * @param {Object} options.payload - GitHub event payload
 * @param {string} options.status - Execution status (success, failure, unknown)
 * @param {string} options.executionId - Unique execution identifier
 * @param {string} options.repository - Repository full name (owner/repo)
 * @param {string} options.sha - Commit SHA for status checks
 * @param {string} options.serverUrl - GitHub server URL
 * @param {string} options.runId - GitHub Actions run ID
 * @param {string} options.token - GitHub token (GITHUB_TOKEN or PAT)
 * @param {string} [options.reportsPath] - Path to .loki/reports directory
 */
async function postResults(options) {
  var eventName = options.eventName;
  var payload = options.payload;
  var token = options.token;

  if (!token) {
    throw new Error('GitHub token is required. Set GITHUB_TOKEN or provide a PAT.');
  }

  var report = loadReport(options.reportsPath);

  switch (eventName) {
    case 'pull_request_review':
      await postPrComment(options, report);
      await createStatusCheck(options, report);
      break;
    case 'issues':
      await postIssueComment(options, report);
      break;
    case 'workflow_dispatch':
    case 'schedule':
      // For manual and scheduled triggers, create a status check on the SHA
      await createStatusCheck(options, report);
      break;
    default:
      console.log('No reporting action for event:', eventName);
  }
}

/**
 * Post a quality report comment on a pull request.
 *
 * @param {Object} options - Same as postResults options
 * @param {Object} report - Parsed report data
 */
async function postPrComment(options, report) {
  var pr = (options.payload || {}).pull_request || {};
  var prNumber = pr.number;

  if (!prNumber) {
    console.log('No PR number found in payload, skipping PR comment.');
    return;
  }

  var body = renderQualityReport(report, options);
  var parts = options.repository.split('/');
  var owner = parts[0];
  var repo = parts[1];

  await githubApiRequest({
    method: 'POST',
    path: '/repos/' + owner + '/' + repo + '/issues/' + prNumber + '/comments',
    token: options.token,
    body: { body: body },
  });

  console.log('Posted quality report to PR #' + prNumber);
}

/**
 * Post an execution summary comment on an issue.
 *
 * @param {Object} options - Same as postResults options
 * @param {Object} report - Parsed report data
 */
async function postIssueComment(options, report) {
  var issue = (options.payload || {}).issue || {};
  var issueNumber = issue.number;

  if (!issueNumber) {
    console.log('No issue number found in payload, skipping issue comment.');
    return;
  }

  var body = renderExecutionSummary(report, options);
  var parts = options.repository.split('/');
  var owner = parts[0];
  var repo = parts[1];

  await githubApiRequest({
    method: 'POST',
    path: '/repos/' + owner + '/' + repo + '/issues/' + issueNumber + '/comments',
    token: options.token,
    body: { body: body },
  });

  console.log('Posted execution summary to issue #' + issueNumber);
}

/**
 * Create a GitHub commit status check.
 *
 * @param {Object} options - Same as postResults options
 * @param {Object} report - Parsed report data
 */
async function createStatusCheck(options, report) {
  var sha = options.sha;
  if (!sha) {
    console.log('No SHA available, skipping status check.');
    return;
  }

  var parts = options.repository.split('/');
  var owner = parts[0];
  var repo = parts[1];

  var state = options.status === 'success' ? 'success' : 'failure';
  var description = options.status === 'success'
    ? 'Loki Mode execution completed successfully'
    : 'Loki Mode execution completed with errors';

  var targetUrl = options.serverUrl + '/' + options.repository + '/actions/runs/' + options.runId;

  await githubApiRequest({
    method: 'POST',
    path: '/repos/' + owner + '/' + repo + '/statuses/' + sha,
    token: options.token,
    body: {
      state: state,
      target_url: targetUrl,
      description: description,
      context: 'loki-mode/enterprise',
    },
  });

  console.log('Created status check on commit ' + sha.substring(0, 7) + ': ' + state);
}

/**
 * Load execution report from the reports directory.
 *
 * @param {string} [reportsPath] - Path to .loki/reports
 * @returns {Object} Parsed report data with defaults
 */
function loadReport(reportsPath) {
  var report = {
    qualityGates: [],
    tasksCompleted: 0,
    tasksFailed: 0,
    totalTasks: 0,
    duration: 'unknown',
    deploymentUrl: null,
    summary: 'No detailed report available.',
  };

  if (!reportsPath) {
    return report;
  }

  // Try to load quality gate results
  var qualityPath = path.join(reportsPath, 'quality-gates.json');
  if (fs.existsSync(qualityPath)) {
    try {
      var qualityData = JSON.parse(fs.readFileSync(qualityPath, 'utf8'));
      report.qualityGates = qualityData.gates || qualityData || [];
    } catch (e) {
      console.log('Warning: Could not parse quality-gates.json:', e.message);
    }
  }

  // Try to load execution summary
  var summaryPath = path.join(reportsPath, 'summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      var summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      report.tasksCompleted = summaryData.tasksCompleted || 0;
      report.tasksFailed = summaryData.tasksFailed || 0;
      report.totalTasks = summaryData.totalTasks || 0;
      report.duration = summaryData.duration || 'unknown';
      report.deploymentUrl = summaryData.deploymentUrl || null;
      report.summary = summaryData.summary || report.summary;
    } catch (e) {
      console.log('Warning: Could not parse summary.json:', e.message);
    }
  }

  return report;
}

/**
 * Render quality report markdown for PR comments.
 *
 * @param {Object} report - Parsed report data
 * @param {Object} options - Execution options
 * @returns {string} Formatted markdown
 */
function renderQualityReport(report, options) {
  var templatePath = path.join(__dirname, 'templates', 'quality-report.md');
  var template = '';

  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, 'utf8');
  } else {
    template = getDefaultQualityReportTemplate();
  }

  return applyTemplate(template, report, options);
}

/**
 * Render execution summary markdown for issue comments.
 *
 * @param {Object} report - Parsed report data
 * @param {Object} options - Execution options
 * @returns {string} Formatted markdown
 */
function renderExecutionSummary(report, options) {
  var templatePath = path.join(__dirname, 'templates', 'execution-summary.md');
  var template = '';

  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, 'utf8');
  } else {
    template = getDefaultExecutionSummaryTemplate();
  }

  return applyTemplate(template, report, options);
}

/**
 * Apply template variables to a markdown template string.
 *
 * @param {string} template - Template with {{variable}} placeholders
 * @param {Object} report - Report data
 * @param {Object} options - Execution options
 * @returns {string} Rendered template
 */
function applyTemplate(template, report, options) {
  var statusLabel = options.status === 'success' ? 'PASS' : 'FAIL';

  // Build quality gates table rows
  var gatesRows = '';
  if (Array.isArray(report.qualityGates) && report.qualityGates.length > 0) {
    gatesRows = report.qualityGates.map(function (gate) {
      var gateStatus = gate.passed ? 'PASS' : 'FAIL';
      return '| ' + (gate.name || 'Unknown') + ' | ' + gateStatus + ' | ' + (gate.details || '-') + ' |';
    }).join('\n');
  } else {
    gatesRows = '| No quality gate data available | - | - |';
  }

  var deploymentLine = report.deploymentUrl
    ? '[View Deployment](' + report.deploymentUrl + ')'
    : 'N/A';

  var runUrl = options.serverUrl + '/' + options.repository + '/actions/runs/' + options.runId;

  var replacements = {
    '{{STATUS}}': statusLabel,
    '{{EXECUTION_ID}}': options.executionId || 'unknown',
    '{{TASKS_COMPLETED}}': String(report.tasksCompleted),
    '{{TASKS_FAILED}}': String(report.tasksFailed),
    '{{TOTAL_TASKS}}': String(report.totalTasks),
    '{{DURATION}}': report.duration || 'unknown',
    '{{QUALITY_GATES_TABLE}}': gatesRows,
    '{{DEPLOYMENT_URL}}': deploymentLine,
    '{{RUN_URL}}': runUrl,
    '{{SUMMARY}}': report.summary || 'No summary available.',
    '{{REPOSITORY}}': options.repository || '',
    '{{SHA}}': (options.sha || '').substring(0, 7),
  };

  var result = template;
  Object.keys(replacements).forEach(function (key) {
    // Replace all occurrences
    while (result.indexOf(key) !== -1) {
      result = result.replace(key, replacements[key]);
    }
  });

  return result;
}

/**
 * Default quality report template (used if template file is missing).
 *
 * @returns {string} Template string
 */
function getDefaultQualityReportTemplate() {
  return [
    '## Loki Mode Quality Report',
    '',
    '**Status:** {{STATUS}} | **Execution:** `{{EXECUTION_ID}}`',
    '',
    '### Quality Gates',
    '',
    '| Gate | Status | Details |',
    '|------|--------|---------|',
    '{{QUALITY_GATES_TABLE}}',
    '',
    '### Summary',
    '',
    '- Tasks: {{TASKS_COMPLETED}}/{{TOTAL_TASKS}} completed, {{TASKS_FAILED}} failed',
    '- Duration: {{DURATION}}',
    '- Deployment: {{DEPLOYMENT_URL}}',
    '',
    '---',
    '[View full run]({{RUN_URL}}) | Commit: `{{SHA}}`',
  ].join('\n');
}

/**
 * Default execution summary template (used if template file is missing).
 *
 * @returns {string} Template string
 */
function getDefaultExecutionSummaryTemplate() {
  return [
    '## Loki Mode Execution Summary',
    '',
    '**Status:** {{STATUS}} | **Execution:** `{{EXECUTION_ID}}`',
    '',
    '### Results',
    '',
    '{{SUMMARY}}',
    '',
    '### Metrics',
    '',
    '- Tasks completed: {{TASKS_COMPLETED}}/{{TOTAL_TASKS}}',
    '- Tasks failed: {{TASKS_FAILED}}',
    '- Duration: {{DURATION}}',
    '',
    '---',
    '[View full run]({{RUN_URL}})',
  ].join('\n');
}

/**
 * Make a request to the GitHub REST API.
 *
 * @param {Object} options
 * @param {string} options.method - HTTP method
 * @param {string} options.path - API path (e.g., /repos/owner/repo/issues/1/comments)
 * @param {string} options.token - Authentication token
 * @param {Object} [options.body] - Request body (will be JSON stringified)
 * @returns {Promise<Object>} Parsed response body
 */
function githubApiRequest(options) {
  return new Promise(function (resolve, reject) {
    var bodyStr = options.body ? JSON.stringify(options.body) : '';

    var reqOptions = {
      hostname: 'api.github.com',
      port: 443,
      path: options.path,
      method: options.method,
      headers: {
        'Authorization': 'token ' + options.token,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'loki-mode-enterprise',
        'Content-Type': 'application/json',
      },
    };

    if (bodyStr) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    var req = https.request(reqOptions, function (res) {
      var data = '';
      res.on('data', function (chunk) {
        data += chunk;
      });
      res.on('end', function () {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            resolve({});
          }
        } else {
          reject(new Error('GitHub API error ' + res.statusCode + ': ' + data));
        }
      });
    });

    req.on('error', function (err) {
      reject(err);
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

module.exports = {
  postResults: postResults,
  postPrComment: postPrComment,
  postIssueComment: postIssueComment,
  createStatusCheck: createStatusCheck,
  loadReport: loadReport,
  renderQualityReport: renderQualityReport,
  renderExecutionSummary: renderExecutionSummary,
  applyTemplate: applyTemplate,
  githubApiRequest: githubApiRequest,
};
