'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * OAuth 2.1 + PKCE Authentication for MCP Server
 *
 * When auth is configured (via config file or environment), all tool calls
 * require a valid Bearer token. When no auth config exists, tools are
 * accessible without authentication for backward compatibility.
 */

const CONFIG_FILENAME = '.loki/mcp-auth.json';

class OAuthValidator {
  constructor(options) {
    this._enabled = false;
    this._tokens = new Map(); // token -> { scope, expiresAt }
    this._clients = new Map(); // clientId -> { secret, redirectUri, scopes }
    this._codeVerifiers = new Map(); // authCode -> { clientId, codeChallenge, expiresAt }

    if (options && options.configPath) {
      this._loadConfig(options.configPath);
    } else {
      this._loadConfigFromEnv();
    }
  }

  /**
   * Check whether auth is enabled.
   */
  get enabled() {
    return this._enabled;
  }

  /**
   * Validate a request. Returns { valid, error, scope }.
   *
   * If auth is not enabled, returns { valid: true } unconditionally.
   */
  validate(request) {
    if (!this._enabled) {
      return { valid: true, scope: '*' };
    }

    // Extract token from params._meta.authorization or from request headers
    let token = null;

    if (request && request.params && request.params._meta &&
        request.params._meta.authorization) {
      const authHeader = request.params._meta.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return { valid: false, error: 'Missing or invalid authorization token' };
    }

    return this.validateToken(token);
  }

  /**
   * Validate a Bearer token.
   */
  validateToken(token) {
    if (!this._enabled) {
      return { valid: true, scope: '*' };
    }

    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Missing or invalid token' };
    }

    const entry = this._tokens.get(token);
    if (!entry) {
      return { valid: false, error: 'Invalid token' };
    }

    if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
      this._tokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, scope: entry.scope || '*' };
  }

  /**
   * Validate an HTTP Authorization header value (for SSE transport).
   */
  validateHeader(authorizationHeader) {
    if (!this._enabled) {
      return { valid: true, scope: '*' };
    }

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing or invalid authorization header' };
    }

    return this.validateToken(authorizationHeader.slice(7));
  }

  /**
   * Issue a token (for testing or programmatic use).
   * In production, tokens come from an external OAuth provider.
   */
  issueToken(scope, ttlMs) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this._tokens.set(token, { scope: scope || '*', expiresAt });
    return { token, expiresAt };
  }

  /**
   * Revoke a token.
   */
  revokeToken(token) {
    return this._tokens.delete(token);
  }

  /**
   * Validate a PKCE code challenge.
   * Method must be S256 (SHA-256) per OAuth 2.1 spec.
   */
  validatePKCE(codeVerifier, codeChallenge) {
    if (!codeVerifier || !codeChallenge) {
      return false;
    }
    const computed = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return computed === codeChallenge;
  }

  /**
   * Register a client (for testing/config).
   */
  registerClient(clientId, clientConfig) {
    this._clients.set(clientId, clientConfig);
    if (!this._enabled) {
      this._enabled = true;
    }
  }

  _loadConfig(configPath) {
    try {
      const resolved = path.resolve(configPath);
      if (!fs.existsSync(resolved)) {
        this._enabled = false;
        return;
      }
      const raw = fs.readFileSync(resolved, 'utf8');
      const config = JSON.parse(raw);
      this._applyConfig(config);
    } catch (err) {
      process.stderr.write('[mcp-auth] Failed to load config: ' + err.message + '\n');
      this._enabled = false;
    }
  }

  _loadConfigFromEnv() {
    // Check for auth config file in project root
    const projectConfig = path.resolve(process.cwd(), CONFIG_FILENAME);
    if (fs.existsSync(projectConfig)) {
      this._loadConfig(projectConfig);
      return;
    }

    // Check environment variables
    if (process.env.MCP_AUTH_TOKEN) {
      this._enabled = true;
      this._tokens.set(process.env.MCP_AUTH_TOKEN, {
        scope: process.env.MCP_AUTH_SCOPE || '*',
        expiresAt: null
      });
      return;
    }

    // No auth configuration found -- auth disabled
    this._enabled = false;
  }

  _applyConfig(config) {
    if (!config || !config.enabled) {
      this._enabled = false;
      return;
    }

    this._enabled = true;

    if (config.clients && Array.isArray(config.clients)) {
      for (const client of config.clients) {
        if (client.id) {
          this._clients.set(client.id, {
            secret: client.secret,
            redirectUri: client.redirectUri,
            scopes: client.scopes || ['*']
          });
        }
      }
    }

    if (config.tokens && Array.isArray(config.tokens)) {
      for (const t of config.tokens) {
        if (t.value) {
          this._tokens.set(t.value, {
            scope: t.scope || '*',
            expiresAt: t.expiresAt ? new Date(t.expiresAt).getTime() : null
          });
        }
      }
    }
  }
}

module.exports = { OAuthValidator };
