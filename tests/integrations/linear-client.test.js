'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { LinearClient, LinearApiError, RateLimitError } = require('../../src/integrations/linear/client');

// Mock response helper
function mockResponse(statusCode, body, headers = {}) {
  return { statusCode, body: typeof body === 'string' ? body : JSON.stringify(body), headers };
}

describe('LinearClient', () => {
  describe('constructor', () => {
    it('requires an API key', () => {
      assert.throws(() => new LinearClient(), { message: /API key is required/ });
      assert.throws(() => new LinearClient(''), { message: /API key is required/ });
      assert.throws(() => new LinearClient(123), { message: /API key is required/ });
    });

    it('creates client with valid API key', () => {
      const client = new LinearClient('lin_api_test123');
      assert.equal(client.apiKey, 'lin_api_test123');
      assert.equal(client.timeout, 15000);
    });

    it('accepts custom timeout', () => {
      const client = new LinearClient('lin_api_test123', { timeout: 5000 });
      assert.equal(client.timeout, 5000);
    });
  });

  describe('graphql (with mocked _request)', () => {
    let client;

    beforeEach(() => {
      client = new LinearClient('lin_api_test123');
    });

    it('parses successful response', async () => {
      client._request = async () => mockResponse(200, {
        data: { issue: { id: '123', title: 'Test' } },
      });

      const data = await client.graphql('query { issue(id: "123") { id title } }');
      assert.deepEqual(data, { issue: { id: '123', title: 'Test' } });
    });

    it('throws on GraphQL errors', async () => {
      client._request = async () => mockResponse(200, {
        errors: [{ message: 'Issue not found' }],
      });

      await assert.rejects(
        () => client.graphql('query { issue(id: "bad") { id } }'),
        { message: /Issue not found/ }
      );
    });

    it('throws on HTTP errors', async () => {
      client._request = async () => mockResponse(500, 'Internal Server Error');

      await assert.rejects(
        () => client.graphql('query { viewer { id } }'),
        (err) => {
          assert.ok(err instanceof LinearApiError);
          assert.equal(err.statusCode, 500);
          return true;
        }
      );
    });

    it('throws RateLimitError on 429', async () => {
      client._request = async () => mockResponse(429, 'Too Many Requests', {
        'retry-after': '60',
      });

      await assert.rejects(
        () => client.graphql('query { viewer { id } }'),
        (err) => {
          assert.ok(err instanceof RateLimitError);
          assert.equal(err.retryAfterMs, 60000);
          return true;
        }
      );
    });

    it('tracks rate limit headers', async () => {
      client._request = async () => mockResponse(200, { data: { ok: true } }, {
        'x-ratelimit-remaining': '50',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      });

      await client.graphql('query { viewer { id } }');
      assert.equal(client._rateLimitRemaining, 50);
      assert.ok(client._rateLimitReset > Date.now());
    });

    it('throws RateLimitError when remaining is 0 and reset is in future', async () => {
      client._rateLimitRemaining = 0;
      client._rateLimitReset = Date.now() + 60000;

      await assert.rejects(
        () => client.graphql('query { viewer { id } }'),
        (err) => {
          assert.ok(err instanceof RateLimitError);
          return true;
        }
      );
    });

    it('throws on non-JSON response', async () => {
      client._request = async () => mockResponse(200, 'not json');

      await assert.rejects(
        () => client.graphql('query { viewer { id } }'),
        { message: /Failed to parse/ }
      );
    });
  });

  describe('getIssue (with mocked _request)', () => {
    it('returns issue data', async () => {
      const client = new LinearClient('lin_api_key');
      const issueData = {
        id: 'issue-1',
        identifier: 'ENG-42',
        title: 'Fix login bug',
        description: 'Users cannot log in',
        priority: 2,
        priorityLabel: 'High',
        url: 'https://linear.app/team/issue/ENG-42',
        state: { id: 'state-1', name: 'In Progress', type: 'started' },
        assignee: { id: 'user-1', name: 'Alice', email: 'alice@test.com' },
        labels: { nodes: [{ id: 'label-1', name: 'bug' }] },
        parent: null,
        children: { nodes: [] },
        relations: { nodes: [] },
      };

      client._request = async () => mockResponse(200, { data: { issue: issueData } });
      const issue = await client.getIssue('issue-1');
      assert.equal(issue.id, 'issue-1');
      assert.equal(issue.title, 'Fix login bug');
      assert.equal(issue.state.name, 'In Progress');
    });
  });

  describe('getProject (with mocked _request)', () => {
    it('returns project data with issues', async () => {
      const client = new LinearClient('lin_api_key');
      const projectData = {
        id: 'proj-1',
        name: 'Auth Overhaul',
        description: 'Rewrite auth system',
        state: 'started',
        url: 'https://linear.app/team/project/proj-1',
        lead: { id: 'user-1', name: 'Bob' },
        issues: {
          nodes: [
            {
              id: 'i1', identifier: 'ENG-1', title: 'Design auth flow',
              description: 'Design the new auth flow', priority: 2, priorityLabel: 'High',
              state: { name: 'Done', type: 'completed' },
              labels: { nodes: [{ name: 'design' }] },
            },
          ],
        },
      };

      client._request = async () => mockResponse(200, { data: { project: projectData } });
      const project = await client.getProject('proj-1');
      assert.equal(project.name, 'Auth Overhaul');
      assert.equal(project.issues.nodes.length, 1);
    });
  });

  describe('updateIssue (with mocked _request)', () => {
    it('sends update mutation', async () => {
      const client = new LinearClient('lin_api_key');
      let sentBody;
      client._request = async (body) => {
        sentBody = JSON.parse(body);
        return mockResponse(200, {
          data: {
            issueUpdate: {
              success: true,
              issue: { id: 'issue-1', identifier: 'ENG-42', state: { name: 'Done' } },
            },
          },
        });
      };

      const result = await client.updateIssue('issue-1', { stateId: 'state-done' });
      assert.equal(result.success, true);
      assert.ok(sentBody.query.includes('issueUpdate'));
      assert.equal(sentBody.variables.id, 'issue-1');
      assert.equal(sentBody.variables.input.stateId, 'state-done');
    });
  });

  describe('createComment (with mocked _request)', () => {
    it('sends comment mutation', async () => {
      const client = new LinearClient('lin_api_key');
      client._request = async () => mockResponse(200, {
        data: {
          commentCreate: {
            success: true,
            comment: { id: 'comment-1', body: 'Test comment', createdAt: '2026-01-01' },
          },
        },
      });

      const result = await client.createComment('issue-1', 'Test comment');
      assert.equal(result.success, true);
      assert.equal(result.comment.body, 'Test comment');
    });
  });

  describe('createSubIssue (with mocked _request)', () => {
    it('sends create sub-issue mutation', async () => {
      const client = new LinearClient('lin_api_key');
      let sentBody;
      client._request = async (body) => {
        sentBody = JSON.parse(body);
        return mockResponse(200, {
          data: {
            issueCreate: {
              success: true,
              issue: { id: 'sub-1', identifier: 'ENG-43', title: 'Subtask', url: 'https://...' },
            },
          },
        });
      };

      const result = await client.createSubIssue('parent-1', 'team-1', 'Subtask', 'Details');
      assert.equal(result.success, true);
      assert.equal(sentBody.variables.input.parentId, 'parent-1');
      assert.equal(sentBody.variables.input.teamId, 'team-1');
    });
  });

  describe('getTeamStates (with mocked _request)', () => {
    it('returns workflow states', async () => {
      const client = new LinearClient('lin_api_key');
      client._request = async () => mockResponse(200, {
        data: {
          team: {
            states: {
              nodes: [
                { id: 's1', name: 'Backlog', type: 'backlog' },
                { id: 's2', name: 'In Progress', type: 'started' },
                { id: 's3', name: 'In Review', type: 'started' },
                { id: 's4', name: 'Done', type: 'completed' },
              ],
            },
          },
        },
      });

      const states = await client.getTeamStates('team-1');
      assert.equal(states.length, 4);
      assert.equal(states[1].name, 'In Progress');
    });
  });
});
