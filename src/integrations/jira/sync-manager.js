'use strict';

var { convertEpicToPrd, generatePrdMetadata } = require('./epic-converter');

var STATUS_MAP = {
  'planning': 'In Progress',
  'building': 'In Progress',
  'testing': 'In Review',
  'reviewing': 'In Review',
  'deployed': 'Done',
  'completed': 'Done',
  'failed': 'Blocked',
  'blocked': 'Blocked',
};

/**
 * Jira Bidirectional Sync Manager.
 */
class JiraSyncManager {
  /**
   * @param {object} opts
   * @param {object} opts.apiClient - JiraApiClient instance
   * @param {string} [opts.projectKey] - Default Jira project key
   */
  constructor(opts) {
    if (!opts || !opts.apiClient) {
      throw new Error('JiraSyncManager requires apiClient');
    }
    this._api = opts.apiClient;
    this._projectKey = opts.projectKey || null;
  }

  /**
   * Inbound: Fetch a Jira epic and convert to PRD.
   * @param {string} epicKey - Epic issue key (e.g., PROJ-123)
   * @returns {Promise<{ prd: string, metadata: object }>}
   */
  async syncFromJira(epicKey) {
    var epic = await this._api.getIssue(epicKey);
    var childResult = await this._api.getEpicChildren(epicKey);
    var children = (childResult && childResult.issues) || [];
    var prd = convertEpicToPrd(epic, children);
    var metadata = generatePrdMetadata(epic);
    return { prd: prd, metadata: metadata };
  }

  /**
   * Outbound: Sync RARV state to Jira epic.
   * @param {string} epicKey
   * @param {object} rarvState - { phase, details, progress }
   */
  async syncToJira(epicKey, rarvState) {
    if (!rarvState || !rarvState.phase) return;
    // Update status via transition
    var jiraStatus = mapLokiStatusToJira(rarvState.phase);
    if (jiraStatus) {
      await this._transitionToStatus(epicKey, jiraStatus);
    }
    // Add progress comment
    if (rarvState.details) {
      var comment = '[Loki Mode] Phase: ' + rarvState.phase;
      if (rarvState.progress) comment += ' (' + rarvState.progress + '%)';
      comment += '\n' + rarvState.details;
      await this._api.addComment(epicKey, comment);
    }
  }

  /**
   * Update a specific issue's status.
   */
  async updateTaskStatus(issueKey, status, details) {
    var jiraStatus = mapLokiStatusToJira(status);
    if (jiraStatus) {
      await this._transitionToStatus(issueKey, jiraStatus);
    }
    if (details) {
      await this._api.addComment(issueKey, '[Loki Mode] Status: ' + status + '\n' + details);
    }
  }

  /**
   * Post a quality report as a Jira comment.
   */
  async postQualityReport(issueKey, report) {
    var text = '[Loki Mode] Quality Report\n';
    if (report.type) text += 'Type: ' + report.type + '\n';
    if (report.summary) text += report.summary + '\n';
    if (report.passed !== undefined) text += 'Passed: ' + report.passed + '\n';
    if (report.failed !== undefined) text += 'Failed: ' + report.failed + '\n';
    if (report.coverage !== undefined) text += 'Coverage: ' + report.coverage + '%\n';
    await this._api.addComment(issueKey, text);
  }

  /**
   * Add a deployment link to a Jira issue.
   */
  async addDeploymentLink(issueKey, deployUrl, env) {
    var title = 'Deployment' + (env ? ' (' + env + ')' : '');
    await this._api.addRemoteLink(issueKey, deployUrl, title);
  }

  /**
   * Create sub-tasks in Jira mirroring Loki's decomposition.
   * @param {string} parentKey
   * @param {object[]} tasks - [{ title, description }]
   * @returns {Promise<string[]>} Created issue keys
   */
  async createSubTasks(parentKey, tasks) {
    var keys = [];
    for (var i = 0; i < tasks.length; i++) {
      var fields = {
        summary: tasks[i].title,
        description: tasks[i].description || '',
        issuetype: { name: 'Sub-task' },
        parent: { key: parentKey },
      };
      if (this._projectKey) fields.project = { key: this._projectKey };
      var result = await this._api.createIssue(fields);
      keys.push(result.key);
    }
    return keys;
  }

  async _transitionToStatus(issueKey, targetStatus) {
    var transResult = await this._api.getTransitions(issueKey);
    var transitions = (transResult && transResult.transitions) || [];
    for (var i = 0; i < transitions.length; i++) {
      if (transitions[i].name === targetStatus || transitions[i].to.name === targetStatus) {
        await this._api.transitionIssue(issueKey, transitions[i].id);
        return;
      }
    }
  }
}

/**
 * Map Loki Mode status to Jira transition name.
 */
function mapLokiStatusToJira(lokiStatus) {
  return STATUS_MAP[String(lokiStatus).toLowerCase()] || null;
}

module.exports = { JiraSyncManager, mapLokiStatusToJira, STATUS_MAP };
