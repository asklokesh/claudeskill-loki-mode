'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Continuity resource provider
 *
 * Exposes CONTINUITY.md as an MCP resource at loki://state/continuity
 */

const RESOURCE_URI = 'loki://state/continuity';

const schema = {
  uri: RESOURCE_URI,
  name: 'Continuity Document',
  description: 'The CONTINUITY.md file containing session state, decisions, and context for continuation.',
  mimeType: 'text/markdown'
};

function read() {
  const lokiDir = path.resolve(process.cwd(), '.loki');
  const continuityPath = path.join(lokiDir, 'CONTINUITY.md');

  if (!fs.existsSync(continuityPath)) {
    return {
      uri: RESOURCE_URI,
      mimeType: 'text/markdown',
      text: '# No CONTINUITY.md found\n\nNo active session continuity document exists.'
    };
  }

  try {
    const content = fs.readFileSync(continuityPath, 'utf8');
    return {
      uri: RESOURCE_URI,
      mimeType: 'text/markdown',
      text: content
    };
  } catch (err) {
    return {
      uri: RESOURCE_URI,
      mimeType: 'text/markdown',
      text: '# Error reading CONTINUITY.md\n\n' + err.message
    };
  }
}

module.exports = { RESOURCE_URI, schema, read };
