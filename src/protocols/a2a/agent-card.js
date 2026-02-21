'use strict';

var crypto = require('crypto');

var DEFAULT_SKILLS = [
  { id: 'prd-to-product', name: 'PRD to Product', description: 'Takes a PRD and builds a fully deployed product' },
  { id: 'code-review', name: 'Code Review', description: 'Multi-reviewer parallel code review with anti-sycophancy' },
  { id: 'testing', name: 'Testing', description: 'Comprehensive test generation and execution' },
  { id: 'deployment', name: 'Deployment', description: 'Production deployment with verification' },
];

var DEFAULT_AUTH_SCHEMES = ['bearer', 'api-key'];

/**
 * A2A Agent Card - advertises agent capabilities per the A2A spec.
 * Served at /.well-known/agent.json
 */
class AgentCard {
  /**
   * @param {object} [opts]
   * @param {string} [opts.name] - Agent name
   * @param {string} [opts.description] - Agent description
   * @param {string} [opts.url] - Agent endpoint URL
   * @param {string} [opts.version] - Agent version
   * @param {object[]} [opts.skills] - Agent skills
   * @param {string[]} [opts.authSchemes] - Supported auth schemes
   * @param {boolean} [opts.streaming] - Whether streaming is supported
   */
  constructor(opts) {
    opts = opts || {};
    this._name = opts.name || 'Loki Mode';
    this._description = opts.description || 'Multi-agent autonomous system by Autonomi';
    this._url = opts.url || 'http://localhost:8080';
    this._version = opts.version || '1.0.0';
    this._skills = opts.skills || DEFAULT_SKILLS.slice();
    this._authSchemes = opts.authSchemes || DEFAULT_AUTH_SCHEMES.slice();
    this._streaming = opts.streaming !== false;
    this._id = opts.id || crypto.randomUUID();
  }

  /**
   * Generate the agent card JSON object.
   */
  toJSON() {
    return {
      id: this._id,
      name: this._name,
      description: this._description,
      url: this._url,
      version: this._version,
      capabilities: {
        streaming: this._streaming,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      skills: this._skills.map(function (s) {
        return { id: s.id, name: s.name, description: s.description };
      }),
      authentication: {
        schemes: this._authSchemes.slice(),
      },
      defaultInputModes: ['text/plain', 'application/json'],
      defaultOutputModes: ['text/plain', 'application/json'],
    };
  }

  /**
   * Handle an HTTP request for the agent card.
   * @param {object} req - HTTP request (needs req.url)
   * @param {object} res - HTTP response
   * @returns {boolean} true if handled
   */
  handleRequest(req, res) {
    if (req.url === '/.well-known/agent.json' && (req.method === 'GET' || req.method === 'HEAD')) {
      var body = JSON.stringify(this.toJSON(), null, 2);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'public, max-age=3600',
      });
      if (req.method !== 'HEAD') res.end(body);
      else res.end();
      return true;
    }
    return false;
  }

  addSkill(skill) {
    if (!skill || !skill.id || !skill.name) {
      throw new Error('Skill requires id and name');
    }
    this._skills.push({ id: skill.id, name: skill.name, description: skill.description || '' });
  }

  getSkills() { return this._skills.slice(); }
  getName() { return this._name; }
  getUrl() { return this._url; }
  getId() { return this._id; }
}

module.exports = { AgentCard, DEFAULT_SKILLS, DEFAULT_AUTH_SCHEMES };
