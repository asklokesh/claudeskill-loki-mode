'use strict';

const https = require('https');

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const LINEAR_HOST = 'api.linear.app';
const LINEAR_PATH = '/graphql';

/**
 * Linear GraphQL API client.
 * Uses Node.js built-in https module. No external dependencies.
 */
class LinearClient {
  /**
   * @param {string} apiKey - Linear API key
   * @param {object} [options]
   * @param {number} [options.timeout=15000] - Request timeout in ms
   */
  constructor(apiKey, options = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Linear API key is required');
    }
    this.apiKey = apiKey;
    this.timeout = options.timeout ?? 15000;
    this._rateLimitRemaining = null;
    this._rateLimitReset = null;
  }

  /**
   * Execute a GraphQL query against the Linear API.
   * @param {string} query - GraphQL query string
   * @param {object} [variables] - Query variables
   * @returns {Promise<object>} Response data
   */
  async graphql(query, variables = {}) {
    // Check rate limit before making request
    if (this._rateLimitRemaining !== null && this._rateLimitRemaining <= 0) {
      const now = Date.now();
      if (this._rateLimitReset && this._rateLimitReset > now) {
        const waitMs = this._rateLimitReset - now;
        throw new RateLimitError(
          `Linear API rate limit exceeded. Resets in ${Math.ceil(waitMs / 1000)}s`,
          waitMs
        );
      }
    }

    const body = JSON.stringify({ query, variables });

    const response = await this._request(body);

    // Track rate limit headers
    if (response.headers) {
      const remaining = response.headers['x-ratelimit-remaining'];
      const reset = response.headers['x-ratelimit-reset'];
      if (remaining !== undefined) {
        this._rateLimitRemaining = parseInt(remaining, 10);
      }
      if (reset !== undefined) {
        this._rateLimitReset = parseInt(reset, 10) * 1000;
      }
    }

    if (response.statusCode === 429) {
      const retryAfter = response.headers['retry-after'];
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
      throw new RateLimitError('Linear API rate limit exceeded', waitMs);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new LinearApiError(
        `Linear API returned HTTP ${response.statusCode}: ${response.body}`,
        response.statusCode
      );
    }

    let data;
    try {
      data = JSON.parse(response.body);
    } catch (e) {
      throw new LinearApiError('Failed to parse Linear API response as JSON', 0);
    }

    if (data.errors && data.errors.length > 0) {
      const msg = data.errors.map((e) => e.message).join('; ');
      throw new LinearApiError(`Linear GraphQL error: ${msg}`, response.statusCode);
    }

    return data.data;
  }

  /**
   * Fetch a single issue by ID.
   * @param {string} issueId
   * @returns {Promise<object>}
   */
  async getIssue(issueId) {
    const query = `
      query GetIssue($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          url
          state {
            id
            name
            type
          }
          assignee {
            id
            name
            email
          }
          labels {
            nodes {
              id
              name
            }
          }
          parent {
            id
            identifier
            title
          }
          children {
            nodes {
              id
              identifier
              title
              state {
                name
              }
            }
          }
          relations {
            nodes {
              type
              relatedIssue {
                id
                identifier
                title
              }
            }
          }
        }
      }
    `;
    const data = await this.graphql(query, { id: issueId });
    return data.issue;
  }

  /**
   * Fetch a project by ID.
   * @param {string} projectId
   * @returns {Promise<object>}
   */
  async getProject(projectId) {
    const query = `
      query GetProject($id: String!) {
        project(id: $id) {
          id
          name
          description
          state
          url
          lead {
            id
            name
          }
          issues {
            nodes {
              id
              identifier
              title
              description
              priority
              priorityLabel
              state {
                name
                type
              }
              labels {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    `;
    const data = await this.graphql(query, { id: projectId });
    return data.project;
  }

  /**
   * Update an issue's state/status.
   * @param {string} issueId
   * @param {object} input - Fields to update (stateId, title, description, etc.)
   * @returns {Promise<object>}
   */
  async updateIssue(issueId, input) {
    const query = `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            state {
              name
            }
          }
        }
      }
    `;
    const data = await this.graphql(query, { id: issueId, input });
    return data.issueUpdate;
  }

  /**
   * Create a comment on an issue.
   * @param {string} issueId
   * @param {string} body - Comment body (markdown)
   * @returns {Promise<object>}
   */
  async createComment(issueId, body) {
    const query = `
      mutation CreateComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment {
            id
            body
            createdAt
          }
        }
      }
    `;
    const data = await this.graphql(query, { issueId, body });
    return data.commentCreate;
  }

  /**
   * Create a sub-issue under a parent issue.
   * @param {string} parentId - Parent issue ID
   * @param {string} teamId - Team ID for the new issue
   * @param {string} title
   * @param {string} [description]
   * @returns {Promise<object>}
   */
  async createSubIssue(parentId, teamId, title, description) {
    const query = `
      mutation CreateSubIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `;
    const input = {
      parentId,
      teamId,
      title,
    };
    if (description) {
      input.description = description;
    }
    const data = await this.graphql(query, { input });
    return data.issueCreate;
  }

  /**
   * Get workflow states for a team (used to map status names to IDs).
   * @param {string} teamId
   * @returns {Promise<Array<object>>}
   */
  async getTeamStates(teamId) {
    const query = `
      query GetTeamStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
    `;
    const data = await this.graphql(query, { teamId });
    return data.team.states.nodes;
  }

  /**
   * Low-level HTTPS request to Linear API.
   * @param {string} body - JSON string
   * @returns {Promise<{statusCode: number, headers: object, body: string}>}
   */
  _request(body) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: LINEAR_HOST,
        path: LINEAR_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.apiKey,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: this.timeout,
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      });

      req.on('error', (err) => reject(new LinearApiError(`Network error: ${err.message}`, 0)));
      req.on('timeout', () => {
        req.destroy();
        reject(new LinearApiError('Request timed out', 0));
      });

      req.write(body);
      req.end();
    });
  }
}

class LinearApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'LinearApiError';
    this.statusCode = statusCode;
  }
}

class RateLimitError extends LinearApiError {
  constructor(message, retryAfterMs) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

module.exports = {
  LinearClient,
  LinearApiError,
  RateLimitError,
  LINEAR_API_URL,
};
