'use strict';

/**
 * STDIO Transport for MCP JSON-RPC 2.0
 *
 * Reads newline-delimited JSON from stdin, writes JSON responses to stdout.
 * Logs go to stderr to avoid polluting the JSON-RPC channel.
 */

class StdioTransport {
  constructor(handler) {
    this._handler = handler;
    this._buffer = '';
    this._running = false;
  }

  start() {
    this._running = true;
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => this._onData(chunk));
    process.stdin.on('end', () => this.stop());
    process.stdin.resume();
  }

  stop() {
    this._running = false;
    process.stdin.pause();
  }

  _onData(chunk) {
    this._buffer += chunk;
    let newlineIdx;
    while ((newlineIdx = this._buffer.indexOf('\n')) !== -1) {
      const line = this._buffer.slice(0, newlineIdx).trim();
      this._buffer = this._buffer.slice(newlineIdx + 1);
      if (line.length > 0) {
        this._processLine(line);
      }
    }
  }

  _processLine(line) {
    let request;
    try {
      request = JSON.parse(line);
    } catch (err) {
      this._send({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error', data: err.message },
        id: null
      });
      return;
    }

    // Handle batch requests
    if (Array.isArray(request)) {
      const promises = request.map((r) => Promise.resolve().then(() => this._handler(r)));
      Promise.all(promises).then((results) => {
        const responses = results.filter((r) => r !== null);
        if (responses.length > 0) {
          this._send(responses);
        }
      }).catch(() => {
        this._send({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
      });
      return;
    }

    Promise.resolve().then(() => this._handler(request)).then((response) => {
      if (response !== null) {
        this._send(response);
      }
    }).catch(() => {
      this._send({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    });
  }

  _send(data) {
    if (!this._running) return;
    const json = JSON.stringify(data);
    process.stdout.write(json + '\n');
  }
}

module.exports = { StdioTransport };
