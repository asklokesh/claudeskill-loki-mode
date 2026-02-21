'use strict';

const http = require('http');

/**
 * SSE (Server-Sent Events) Transport for MCP JSON-RPC 2.0
 *
 * Exposes an HTTP server with:
 * - POST /mcp         - accepts JSON-RPC requests, returns JSON responses
 * - GET  /mcp/events  - SSE stream for server-initiated notifications
 * - GET  /mcp/health  - health check endpoint
 */

// Maximum allowed POST body size (10 MB)
const MAX_BODY_BYTES = 10 * 1024 * 1024;

class SSETransport {
  constructor(handler, options) {
    this._handler = handler;
    this._port = (options && options.port) || 8421;
    // Bind to localhost by default to prevent LAN exposure.
    // Set options.host = '0.0.0.0' to bind all interfaces explicitly.
    this._host = (options && options.host) || '127.0.0.1';
    // Configurable CORS origin. Defaults to localhost on the same port.
    // Set options.corsOrigin = '*' only when you explicitly want open CORS.
    this._corsOrigin = (options && options.corsOrigin !== undefined)
      ? options.corsOrigin
      : 'http://localhost:' + ((options && options.port) || 8421);
    this._server = null;
    this._sseClients = new Set();
  }

  start() {
    this._server = http.createServer((req, res) => this._onRequest(req, res));
    this._server.listen(this._port, this._host, () => {
      process.stderr.write(
        '[mcp-sse] Listening on ' + this._host + ':' + this._port + '\n'
      );
    });
  }

  stop() {
    for (const client of this._sseClients) {
      client.end();
    }
    this._sseClients.clear();
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  /**
   * Send a server-initiated notification to all SSE clients.
   */
  broadcast(event, data) {
    const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const client of this._sseClients) {
      client.write(payload);
    }
  }

  _onRequest(req, res) {
    const url = req.url || '';
    const method = req.method || '';

    // CORS headers - restricted to configured origin (default: localhost only)
    res.setHeader('Access-Control-Allow-Origin', this._corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === '/mcp/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', transport: 'sse' }));
      return;
    }

    if (url === '/mcp/events' && method === 'GET') {
      this._handleSSE(req, res);
      return;
    }

    if (url === '/mcp' && method === 'POST') {
      this._handlePost(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Not found. Use POST /mcp, GET /mcp/events, or GET /mcp/health' },
      id: null
    }));
  }

  _handleSSE(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    this._sseClients.add(res);
    req.on('close', () => {
      this._sseClients.delete(res);
    });
  }

  _handlePost(req, res) {
    let body = '';
    let bodyBytes = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      bodyBytes += Buffer.byteLength(chunk);
      if (bodyBytes > MAX_BODY_BYTES) {
        aborted = true;
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Request body too large' },
          id: null
        }));
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (aborted) return;
      let request;
      try {
        request = JSON.parse(body);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error', data: err.message },
          id: null
        }));
        return;
      }

      // Handle batch
      if (Array.isArray(request)) {
        const promises = request.map((r) => Promise.resolve().then(() => this._handler(r)));
        Promise.all(promises).then((results) => {
          const responses = results.filter((r) => r !== null);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responses));
        }).catch(() => {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
          }
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null
          }));
        });
        return;
      }

      Promise.resolve().then(() => this._handler(request)).then((response) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      }).catch(() => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null
        }));
      });
    });
  }
}

module.exports = { SSETransport };
