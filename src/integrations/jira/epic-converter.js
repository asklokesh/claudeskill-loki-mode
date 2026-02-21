'use strict';

/**
 * Convert a Jira epic and its child stories into a PRD markdown document.
 *
 * @param {object} epic - Jira epic issue
 * @param {object[]} children - Child issues (stories, tasks)
 * @returns {string} PRD markdown
 */
function convertEpicToPrd(epic, children) {
  children = children || [];
  var lines = [];

  // Title
  var summary = _extractText(epic.fields && epic.fields.summary) || 'Untitled PRD';
  lines.push('# ' + summary);
  lines.push('');

  // Metadata
  lines.push('## Metadata');
  lines.push('- Source: Jira');
  lines.push('- Epic: ' + (epic.key || 'unknown'));
  if (epic.fields && epic.fields.priority) {
    lines.push('- Priority: ' + _extractText(epic.fields.priority.name));
  }
  if (epic.fields && epic.fields.labels && epic.fields.labels.length > 0) {
    lines.push('- Labels: ' + epic.fields.labels.join(', '));
  }
  lines.push('');

  // Overview
  lines.push('## Overview');
  var desc = _extractDescription(epic.fields && epic.fields.description);
  lines.push(desc || 'No description provided.');
  lines.push('');

  // Requirements / Features
  if (children.length > 0) {
    lines.push('## Requirements');
    lines.push('');
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var childSummary = _extractText(child.fields && child.fields.summary) || 'Untitled';
      var childKey = child.key || '';
      lines.push('### ' + (i + 1) + '. ' + childSummary + ' (' + childKey + ')');
      var childDesc = _extractDescription(child.fields && child.fields.description);
      if (childDesc) lines.push(childDesc);

      var criteria = extractAcceptanceCriteria(childDesc || '');
      if (criteria.length > 0) {
        lines.push('');
        lines.push('**Acceptance Criteria:**');
        for (var j = 0; j < criteria.length; j++) {
          lines.push('- ' + criteria[j]);
        }
      }
      lines.push('');
    }
  }

  // Technical constraints
  if (epic.fields && epic.fields.components && epic.fields.components.length > 0) {
    lines.push('## Technical Constraints');
    lines.push('- Components: ' + epic.fields.components.map(function (c) { return c.name; }).join(', '));
    lines.push('');
  }

  // Success criteria from epic description
  var epicCriteria = extractAcceptanceCriteria(desc || '');
  if (epicCriteria.length > 0) {
    lines.push('## Success Criteria');
    for (var k = 0; k < epicCriteria.length; k++) {
      lines.push('- ' + epicCriteria[k]);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Extract acceptance criteria from description text.
 * Looks for patterns like:
 *   - AC: ... or - Given/When/Then or numbered criteria
 *
 * @param {string} text
 * @returns {string[]}
 */
function extractAcceptanceCriteria(text) {
  if (!text) return [];
  var criteria = [];
  var lines = text.split('\n');
  var inAcSection = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    // Detect AC section header
    if (/^#+\s*(acceptance\s*criteria|ac\b)/i.test(line)) {
      inAcSection = true;
      continue;
    }
    // Another header ends AC section
    if (inAcSection && /^#+\s/.test(line)) {
      inAcSection = false;
      continue;
    }
    if (inAcSection && /^[-*]\s+/.test(line)) {
      criteria.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }
    // Given/When/Then patterns anywhere
    if (/^(given|when|then)\s/i.test(line)) {
      criteria.push(line);
    }
  }
  return criteria;
}

/**
 * Generate PRD metadata for tracking.
 */
function generatePrdMetadata(epic) {
  return {
    source: 'jira',
    epicKey: epic.key || null,
    epicSummary: (epic.fields && epic.fields.summary) || null,
    importedAt: new Date().toISOString(),
  };
}

/**
 * Extract plain text from Jira ADF or plain string.
 */
function _extractDescription(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  // ADF (Atlassian Document Format)
  if (desc.type === 'doc' && Array.isArray(desc.content)) {
    return desc.content.map(function (block) {
      if (block.type === 'paragraph' && Array.isArray(block.content)) {
        return block.content.map(function (node) {
          return node.text || '';
        }).join('');
      }
      return '';
    }).filter(Boolean).join('\n');
  }
  return String(desc);
}

function _extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return String(val);
}

module.exports = { convertEpicToPrd, extractAcceptanceCriteria, generatePrdMetadata };
