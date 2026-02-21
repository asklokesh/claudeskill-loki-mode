'use strict';
var test = require('node:test');
var assert = require('node:assert');
var { convertEpicToPrd, extractAcceptanceCriteria, generatePrdMetadata } = require('../../../src/integrations/jira/epic-converter');

function makeEpic(overrides) {
  return Object.assign({
    key: 'PROJ-1',
    fields: {
      summary: 'Build Authentication System',
      description: 'Implement OAuth2 and session management.\n\n## Acceptance Criteria\n- Users can login via OAuth\n- Sessions expire after 24h',
      priority: { name: 'High' },
      labels: ['auth', 'security'],
      components: [{ name: 'backend' }, { name: 'auth' }],
    },
  }, overrides);
}

function makeChild(key, summary, desc) {
  return {
    key: key,
    fields: {
      summary: summary,
      description: desc || '',
      issuetype: { name: 'Story' },
    },
  };
}

test('convertEpicToPrd - generates full PRD', function () {
  var epic = makeEpic();
  var children = [
    makeChild('PROJ-2', 'OAuth Provider Integration', 'Integrate Google and GitHub OAuth'),
    makeChild('PROJ-3', 'Session Management', 'Implement session tokens'),
  ];
  var prd = convertEpicToPrd(epic, children);
  assert.ok(prd.includes('# Build Authentication System'));
  assert.ok(prd.includes('Source: Jira'));
  assert.ok(prd.includes('Epic: PROJ-1'));
  assert.ok(prd.includes('Priority: High'));
  assert.ok(prd.includes('OAuth Provider Integration'));
  assert.ok(prd.includes('Session Management'));
  assert.ok(prd.includes('Components: backend, auth'));
});

test('convertEpicToPrd - handles ADF description', function () {
  var epic = makeEpic({
    fields: {
      summary: 'Test',
      description: {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ADF content here' }] }],
      },
    },
  });
  var prd = convertEpicToPrd(epic, []);
  assert.ok(prd.includes('ADF content here'));
});

test('convertEpicToPrd - handles empty children', function () {
  var prd = convertEpicToPrd(makeEpic(), []);
  assert.ok(prd.includes('# Build Authentication System'));
  assert.ok(!prd.includes('## Requirements'));
});

test('convertEpicToPrd - handles minimal epic', function () {
  var prd = convertEpicToPrd({ fields: {} }, []);
  assert.ok(prd.includes('# Untitled PRD'));
  assert.ok(prd.includes('No description provided'));
});

test('convertEpicToPrd - includes acceptance criteria', function () {
  var epic = makeEpic();
  var prd = convertEpicToPrd(epic, []);
  assert.ok(prd.includes('Users can login via OAuth'));
  assert.ok(prd.includes('Sessions expire after 24h'));
});

test('convertEpicToPrd - labels in metadata', function () {
  var prd = convertEpicToPrd(makeEpic(), []);
  assert.ok(prd.includes('Labels: auth, security'));
});

test('extractAcceptanceCriteria - from markdown section', function () {
  var text = '## Overview\nSome text\n## Acceptance Criteria\n- Criterion 1\n- Criterion 2\n## Other';
  var criteria = extractAcceptanceCriteria(text);
  assert.equal(criteria.length, 2);
  assert.equal(criteria[0], 'Criterion 1');
  assert.equal(criteria[1], 'Criterion 2');
});

test('extractAcceptanceCriteria - Given/When/Then', function () {
  var text = 'Some text\nGiven a logged in user\nWhen they click logout\nThen session is destroyed';
  var criteria = extractAcceptanceCriteria(text);
  assert.equal(criteria.length, 3);
});

test('extractAcceptanceCriteria - empty text', function () {
  assert.deepStrictEqual(extractAcceptanceCriteria(''), []);
  assert.deepStrictEqual(extractAcceptanceCriteria(null), []);
});

test('generatePrdMetadata - structure', function () {
  var meta = generatePrdMetadata(makeEpic());
  assert.equal(meta.source, 'jira');
  assert.equal(meta.epicKey, 'PROJ-1');
  assert.equal(meta.epicSummary, 'Build Authentication System');
  assert.ok(meta.importedAt);
});
