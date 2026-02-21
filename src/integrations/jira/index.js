'use strict';

var { JiraApiClient, JiraApiError } = require('./api-client');
var { JiraSyncManager, mapLokiStatusToJira, STATUS_MAP } = require('./sync-manager');
var { WebhookHandler } = require('./webhook-handler');
var { convertEpicToPrd, extractAcceptanceCriteria, generatePrdMetadata } = require('./epic-converter');

/**
 * Create a configured Jira sync manager.
 * @param {object} config - { baseUrl, email, apiToken, projectKey }
 */
function createSync(config) {
  var client = new JiraApiClient({
    baseUrl: config.baseUrl,
    email: config.email,
    apiToken: config.apiToken,
    rateDelayMs: config.rateDelayMs,
  });
  return new JiraSyncManager({
    apiClient: client,
    projectKey: config.projectKey,
  });
}

/**
 * Create a configured webhook handler.
 * @param {object} config - { secret, onEpicCreated, onIssueUpdated, issueTypes }
 */
function createWebhookHandler(config) {
  return new WebhookHandler(config);
}

module.exports = {
  JiraApiClient: JiraApiClient,
  JiraApiError: JiraApiError,
  JiraSyncManager: JiraSyncManager,
  WebhookHandler: WebhookHandler,
  convertEpicToPrd: convertEpicToPrd,
  extractAcceptanceCriteria: extractAcceptanceCriteria,
  generatePrdMetadata: generatePrdMetadata,
  mapLokiStatusToJira: mapLokiStatusToJira,
  STATUS_MAP: STATUS_MAP,
  createSync: createSync,
  createWebhookHandler: createWebhookHandler,
};
