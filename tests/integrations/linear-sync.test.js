'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { LinearSync, RARV_STATUS_MAP, PRIORITY_MAP } = require('../../src/integrations/linear/sync');

// Mock config
function mockConfig(overrides = {}) {
  return {
    apiKey: 'lin_api_test',
    teamId: 'team-1',
    webhookSecret: 'webhook-secret-123',
    statusMapping: { ...RARV_STATUS_MAP },
    ...overrides,
  };
}

// Mock Linear issue
function mockIssue(overrides = {}) {
  return {
    id: 'issue-1',
    identifier: 'ENG-42',
    title: 'Implement auth flow',
    description: '- Add OAuth2 support\n- Add SSO integration\n- Write tests',
    priority: 2,
    priorityLabel: 'High',
    url: 'https://linear.app/team/issue/ENG-42',
    state: { id: 'state-2', name: 'Todo', type: 'unstarted' },
    assignee: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    labels: { nodes: [{ id: 'l1', name: 'feature' }, { id: 'l2', name: 'auth' }] },
    parent: null,
    children: {
      nodes: [
        { id: 'child-1', identifier: 'ENG-43', title: 'OAuth2', state: { name: 'Todo' } },
      ],
    },
    relations: {
      nodes: [
        {
          type: 'blocks',
          relatedIssue: { id: 'rel-1', identifier: 'ENG-40', title: 'API refactor' },
        },
      ],
    },
    ...overrides,
  };
}

// Mock project
function mockProject() {
  return {
    id: 'proj-1',
    name: 'Auth Overhaul',
    description: 'Complete rewrite of auth',
    state: 'started',
    url: 'https://linear.app/team/project/proj-1',
    lead: { id: 'user-1', name: 'Bob' },
    issues: {
      nodes: [
        {
          id: 'i1', identifier: 'ENG-1', title: 'Design',
          description: 'Design auth flow', priority: 2, priorityLabel: 'High',
          state: { name: 'Done', type: 'completed' },
          labels: { nodes: [{ name: 'design' }] },
        },
        {
          id: 'i2', identifier: 'ENG-2', title: 'Implement',
          description: 'Implement auth', priority: 3, priorityLabel: 'Medium',
          state: { name: 'In Progress', type: 'started' },
          labels: { nodes: [] },
        },
      ],
    },
  };
}

// Helper to create a sync instance with mocked client
function createMockSync(config) {
  const sync = new LinearSync(config || mockConfig(), { maxRetries: 0, baseDelay: 1 });
  sync.init();

  // Override client methods for testing
  const mockClient = {
    getIssue: async () => mockIssue(),
    getProject: async () => mockProject(),
    updateIssue: async (id, input) => ({
      success: true,
      issue: { id, identifier: 'ENG-42', state: { name: 'In Progress' } },
    }),
    createComment: async (issueId, body) => ({
      success: true,
      comment: { id: 'comment-1', body, createdAt: '2026-01-01' },
    }),
    createSubIssue: async (parentId, teamId, title, desc) => ({
      success: true,
      issue: { id: `sub-${title}`, identifier: `ENG-${Math.random()}`, title, url: 'https://...' },
    }),
    getTeamStates: async () => [
      { id: 's1', name: 'Backlog', type: 'backlog' },
      { id: 's2', name: 'In Progress', type: 'started' },
      { id: 's3', name: 'In Review', type: 'started' },
      { id: 's4', name: 'Done', type: 'completed' },
    ],
  };

  sync.client = mockClient;
  return { sync, mockClient };
}

describe('LinearSync', () => {
  describe('initialization', () => {
    it('extends IntegrationAdapter with name "linear"', () => {
      const sync = new LinearSync(mockConfig());
      assert.equal(sync.name, 'linear');
    });

    it('init returns false when no config', () => {
      const sync = new LinearSync(null);
      // Pass a directory that does not have config
      const result = sync.init('/nonexistent/path');
      assert.equal(result, false);
    });

    it('init returns true with valid config', () => {
      const sync = new LinearSync(mockConfig());
      const result = sync.init();
      assert.equal(result, true);
      assert.ok(sync.client);
    });

    it('throws on invalid config', () => {
      const sync = new LinearSync({ apiKey: '', teamId: null, webhookSecret: null, statusMapping: {} });
      assert.throws(() => sync.init(), { message: /Invalid Linear config/ });
    });

    it('throws when calling methods before init', async () => {
      const sync = new LinearSync(mockConfig());
      // Don't call init()
      await assert.rejects(() => sync.importProject('id'), {
        message: /not initialized/,
      });
    });
  });

  describe('importProject - issue', () => {
    it('converts Linear issue to PRD format', async () => {
      const { sync } = createMockSync();
      const prd = await sync.importProject('issue-1');

      assert.equal(prd.source, 'linear');
      assert.equal(prd.externalId, 'issue-1');
      assert.equal(prd.identifier, 'ENG-42');
      assert.equal(prd.title, 'Implement auth flow');
      assert.equal(prd.priority, 'high');
      assert.deepEqual(prd.labels, ['feature', 'auth']);
      assert.equal(prd.assignee.name, 'Alice');
      assert.equal(prd.dependencies.length, 1);
      assert.equal(prd.dependencies[0].type, 'blocks');
      assert.equal(prd.subtasks.length, 1);
    });

    it('extracts requirements from description', async () => {
      const { sync } = createMockSync();
      const prd = await sync.importProject('issue-1');

      assert.ok(prd.prd.requirements.length >= 3);
      assert.ok(prd.prd.requirements.includes('Add OAuth2 support'));
      assert.ok(prd.prd.requirements.includes('Add SSO integration'));
    });

    it('maps priority numbers correctly', async () => {
      const { sync, mockClient } = createMockSync();

      // Test each priority level
      for (const [num, label] of Object.entries(PRIORITY_MAP)) {
        mockClient.getIssue = async () => mockIssue({ priority: parseInt(num) });
        const prd = await sync.importProject('issue-1');
        assert.equal(prd.priority, label, `Priority ${num} should map to "${label}"`);
      }
    });

    it('handles issue with no assignee', async () => {
      const { sync, mockClient } = createMockSync();
      mockClient.getIssue = async () => mockIssue({ assignee: null });

      const prd = await sync.importProject('issue-1');
      assert.equal(prd.assignee, null);
    });

    it('handles issue with no relations', async () => {
      const { sync, mockClient } = createMockSync();
      mockClient.getIssue = async () => mockIssue({ relations: { nodes: [] } });

      const prd = await sync.importProject('issue-1');
      assert.equal(prd.dependencies.length, 0);
    });
  });

  describe('importProject - project fallback', () => {
    it('converts Linear project to PRD format when issue lookup fails', async () => {
      const { sync, mockClient } = createMockSync();
      mockClient.getIssue = async () => { throw new Error('Not found'); };

      const prd = await sync.importProject('proj-1');
      assert.equal(prd.source, 'linear');
      assert.equal(prd.title, 'Auth Overhaul');
      assert.equal(prd.issues.length, 2);
      assert.ok(prd.prd.requirements.includes('Design'));
      assert.ok(prd.prd.requirements.includes('Implement'));
    });
  });

  describe('syncStatus', () => {
    it('maps REASON to In Progress', async () => {
      const { sync, mockClient } = createMockSync();
      let updatedInput;
      mockClient.updateIssue = async (id, input) => {
        updatedInput = input;
        return { success: true, issue: { id, identifier: 'ENG-42', state: { name: 'In Progress' } } };
      };

      await sync.syncStatus('issue-1', 'REASON');
      assert.equal(updatedInput.stateId, 's2'); // In Progress state ID
    });

    it('maps ACT to In Progress', async () => {
      const { sync, mockClient } = createMockSync();
      let updatedInput;
      mockClient.updateIssue = async (id, input) => {
        updatedInput = input;
        return { success: true, issue: { id, identifier: 'ENG-42', state: { name: 'In Progress' } } };
      };

      await sync.syncStatus('issue-1', 'ACT');
      assert.equal(updatedInput.stateId, 's2');
    });

    it('maps REFLECT to In Review', async () => {
      const { sync, mockClient } = createMockSync();
      let updatedInput;
      mockClient.updateIssue = async (id, input) => {
        updatedInput = input;
        return { success: true, issue: { id, identifier: 'ENG-42', state: { name: 'In Review' } } };
      };

      await sync.syncStatus('issue-1', 'REFLECT');
      assert.equal(updatedInput.stateId, 's3'); // In Review state ID
    });

    it('maps VERIFY to Done', async () => {
      const { sync, mockClient } = createMockSync();
      let updatedInput;
      mockClient.updateIssue = async (id, input) => {
        updatedInput = input;
        return { success: true, issue: { id, identifier: 'ENG-42', state: { name: 'Done' } } };
      };

      await sync.syncStatus('issue-1', 'VERIFY');
      assert.equal(updatedInput.stateId, 's4'); // Done state ID
    });

    it('posts comment with details when provided', async () => {
      const { sync, mockClient } = createMockSync();
      let commentBody;
      mockClient.createComment = async (id, body) => {
        commentBody = body;
        return { success: true, comment: { id: 'c1', body, createdAt: '2026-01-01' } };
      };

      await sync.syncStatus('issue-1', 'ACT', { message: 'Implementing login flow' });
      assert.ok(commentBody.includes('Loki Mode [ACT]'));
      assert.ok(commentBody.includes('Implementing login flow'));
    });

    it('emits status-synced event', async () => {
      const { sync } = createMockSync();
      let event;
      sync.on('status-synced', (data) => { event = data; });

      await sync.syncStatus('issue-1', 'REFLECT');
      assert.equal(event.externalId, 'issue-1');
      assert.equal(event.status, 'REFLECT');
      assert.equal(event.linearStatus, 'In Review');
    });
  });

  describe('postComment', () => {
    it('posts comment and emits event', async () => {
      const { sync, mockClient } = createMockSync();
      let postedBody;
      mockClient.createComment = async (id, body) => {
        postedBody = body;
        return { success: true, comment: { id: 'c1', body, createdAt: '2026-01-01' } };
      };

      let event;
      sync.on('comment-posted', (data) => { event = data; });

      const report = '## Quality Report\n\n- Tests: 42/42 passing\n- Coverage: 87%';
      await sync.postComment('issue-1', report);

      assert.equal(postedBody, report);
      assert.equal(event.externalId, 'issue-1');
      assert.equal(event.commentId, 'c1');
    });
  });

  describe('createSubtasks', () => {
    it('creates sub-issues for each task', async () => {
      const { sync, mockClient } = createMockSync();
      const createdTasks = [];
      mockClient.createSubIssue = async (parentId, teamId, title, desc) => {
        createdTasks.push({ parentId, teamId, title, desc });
        return { success: true, issue: { id: `sub-${title}`, identifier: 'ENG-X', title, url: '' } };
      };

      const tasks = [
        { title: 'Setup OAuth2', description: 'Configure OAuth2 provider' },
        { title: 'Add SSO', description: 'Integrate SSO' },
        { title: 'Write tests', description: 'Unit and integration tests' },
      ];

      const results = await sync.createSubtasks('issue-1', tasks);
      assert.equal(results.length, 3);
      assert.equal(createdTasks.length, 3);
      assert.equal(createdTasks[0].parentId, 'issue-1');
      assert.equal(createdTasks[0].teamId, 'team-1');
      assert.equal(createdTasks[0].title, 'Setup OAuth2');
    });

    it('emits subtasks-created event', async () => {
      const { sync } = createMockSync();
      let event;
      sync.on('subtasks-created', (data) => { event = data; });

      await sync.createSubtasks('issue-1', [
        { title: 'Task 1', description: 'Desc' },
      ]);

      assert.equal(event.externalId, 'issue-1');
      assert.equal(event.count, 1);
    });
  });

  describe('getWebhookHandler', () => {
    it('returns a function', () => {
      const { sync } = createMockSync();
      const handler = sync.getWebhookHandler();
      assert.equal(typeof handler, 'function');
    });

    it('processes valid webhook event', (_, done) => {
      const { sync } = createMockSync();
      const handler = sync.getWebhookHandler();

      const payload = {
        action: 'update',
        type: 'Issue',
        data: { id: 'issue-1', title: 'Updated' },
        updatedFrom: { title: 'Old title' },
      };
      const body = JSON.stringify(payload);

      // Create HMAC signature
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', 'webhook-secret-123');
      hmac.update(body);
      const signature = hmac.digest('hex');

      let webhookEvent;
      sync.on('webhook', (event) => { webhookEvent = event; });

      // Mock request/response
      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.headers = { 'linear-signature': signature };

      const res = {
        writeHead: () => {},
        end: (data) => {
          const result = JSON.parse(data);
          assert.equal(result.received, true);
          assert.equal(webhookEvent.action, 'update');
          assert.equal(webhookEvent.type, 'Issue');
          assert.equal(webhookEvent.data.id, 'issue-1');
          done();
        },
      };

      handler(req, res);
      req.emit('data', body);
      req.emit('end');
    });

    it('rejects invalid signature', (_, done) => {
      const { sync } = createMockSync();
      const handler = sync.getWebhookHandler();

      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.headers = { 'linear-signature': 'invalid-signature-value-that-wont-match' };

      let statusCode;
      const res = {
        writeHead: (code) => { statusCode = code; },
        end: () => {
          assert.equal(statusCode, 401);
          done();
        },
      };

      handler(req, res);
      req.emit('data', '{"action":"test"}');
      req.emit('end');
    });

    it('rejects invalid JSON', (_, done) => {
      const { sync } = createMockSync(mockConfig({ webhookSecret: null }));
      const handler = sync.getWebhookHandler();

      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.headers = {};

      let statusCode;
      const res = {
        writeHead: (code) => { statusCode = code; },
        end: () => {
          assert.equal(statusCode, 400);
          done();
        },
      };

      handler(req, res);
      req.emit('data', 'not json');
      req.emit('end');
    });

    it('skips signature verification when no webhook secret', (_, done) => {
      const { sync } = createMockSync(mockConfig({ webhookSecret: null }));
      const handler = sync.getWebhookHandler();

      let webhookEvent;
      sync.on('webhook', (event) => { webhookEvent = event; });

      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.headers = {};

      const res = {
        writeHead: () => {},
        end: () => {
          assert.equal(webhookEvent.action, 'create');
          done();
        },
      };

      handler(req, res);
      req.emit('data', JSON.stringify({ action: 'create', type: 'Issue', data: {} }));
      req.emit('end');
    });
  });
});
