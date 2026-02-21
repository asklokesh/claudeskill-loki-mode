'use strict';

var crypto = require('crypto');

var VALID_TYPES = ['code', 'deployment', 'test-result', 'report', 'log'];

var TYPE_MIME_MAP = {
  'code': 'text/plain',
  'deployment': 'application/json',
  'test-result': 'application/json',
  'report': 'application/json',
  'log': 'text/plain',
};

/**
 * Create an A2A artifact.
 * @param {string} type - Artifact type
 * @param {*} content - Artifact content
 * @param {object} [metadata] - Artifact metadata
 * @returns {object} Artifact object
 */
function createArtifact(type, content, metadata) {
  if (!type || VALID_TYPES.indexOf(type) === -1) {
    throw new Error('Invalid artifact type: ' + type + '. Valid: ' + VALID_TYPES.join(', '));
  }
  if (content === undefined || content === null) {
    throw new Error('Artifact content is required');
  }
  return {
    id: crypto.randomUUID(),
    type: type,
    mimeType: TYPE_MIME_MAP[type] || 'application/octet-stream',
    content: content,
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate an artifact object.
 * @param {object} artifact
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateArtifact(artifact) {
  var errors = [];
  if (!artifact) {
    return { valid: false, errors: ['Artifact is null or undefined'] };
  }
  if (!artifact.id) errors.push('Missing id');
  if (!artifact.type) errors.push('Missing type');
  else if (VALID_TYPES.indexOf(artifact.type) === -1) {
    errors.push('Invalid type: ' + artifact.type);
  }
  if (artifact.content === undefined || artifact.content === null) {
    errors.push('Missing content');
  }
  if (!artifact.createdAt) errors.push('Missing createdAt');
  return { valid: errors.length === 0, errors: errors };
}

module.exports = { createArtifact, validateArtifact, VALID_TYPES, TYPE_MIME_MAP };
