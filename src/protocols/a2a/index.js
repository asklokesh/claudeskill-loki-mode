'use strict';

var { AgentCard } = require('./agent-card');
var { TaskManager } = require('./task-manager');
var { SSEStream } = require('./streaming');
var { createArtifact, validateArtifact, VALID_TYPES } = require('./artifacts');
var { A2AClient } = require('./client');

/**
 * Create an A2A server configuration.
 * @param {object} [opts] - AgentCard options
 * @returns {{ card: AgentCard, tasks: TaskManager }}
 */
function createServer(opts) {
  return {
    card: new AgentCard(opts),
    tasks: new TaskManager(opts),
  };
}

/**
 * Create an A2A client.
 * @param {object} [opts] - A2AClient options
 * @returns {A2AClient}
 */
function createClient(opts) {
  return new A2AClient(opts);
}

module.exports = {
  AgentCard: AgentCard,
  TaskManager: TaskManager,
  SSEStream: SSEStream,
  A2AClient: A2AClient,
  createArtifact: createArtifact,
  validateArtifact: validateArtifact,
  VALID_TYPES: VALID_TYPES,
  createServer: createServer,
  createClient: createClient,
};
