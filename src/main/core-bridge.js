'use strict';

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

/**
 * Loopback HTTP bridge so the in-page dsh plugin can call desktop core APIs
 * even when contextBridge / preload is missing after navigating to the harness UI.
 */
function createCoreBridge(handlers) {
  const token = crypto.randomBytes(24).toString('hex');
  /** @type {Set<import('http').ServerResponse>} */
  const sseClients = new Set();

  function allowOrigin(origin) {
    if (!origin) return true;
    try {
      const u = new URL(origin);
      return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
    } catch {
      return false;
    }
  }

  function setCors(req, res) {
    const origin = req.headers.origin;
    if (origin && allowOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve(undefined);
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  function authorized(req, url) {
    const header = String(req.headers.authorization || '');
    if (header === `Bearer ${token}`) return true;
    if (url.searchParams.get('token') === token) return true;
    return false;
  }

  function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  function broadcast(event, data) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let url;
    try {
      url = new URL(req.url || '/', 'http://127.0.0.1');
    } catch {
      res.writeHead(400);
      res.end('bad url');
      return;
    }

    if (!authorized(req, url)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }

    try {
      if (url.pathname === '/events' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(': ok\n\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }

      if (url.pathname === '/overview' && req.method === 'GET') {
        return sendJson(res, 200, await handlers.overview());
      }
      if (url.pathname === '/check' && req.method === 'GET') {
        return sendJson(res, 200, await handlers.checkHarness());
      }
      if (url.pathname === '/install' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, await handlers.installHarness(body?.version));
      }
      if (url.pathname === '/restore' && req.method === 'POST') {
        return sendJson(res, 200, await handlers.restoreSeed());
      }
      if (url.pathname === '/restart' && req.method === 'POST') {
        return sendJson(res, 200, await handlers.restartHarness());
      }
      if (url.pathname === '/shell-check' && req.method === 'GET') {
        return sendJson(res, 200, await handlers.checkShellUpdate());
      }
      if (url.pathname === '/shell-install' && req.method === 'POST') {
        return sendJson(res, 200, await handlers.installShellUpdate());
      }
      if (url.pathname === '/cleanup' && req.method === 'POST') {
        return sendJson(res, 200, await handlers.cleanup());
      }
      if (url.pathname === '/diagnose' && req.method === 'GET') {
        return sendJson(res, 200, await handlers.diagnose());
      }
      if (url.pathname === '/open-path' && req.method === 'POST') {
        const body = await readBody(req);
        return sendJson(res, 200, { path: await handlers.openPath(body?.which) });
      }

      sendJson(res, 404, { error: 'not found' });
    } catch (error) {
      sendJson(res, 500, { error: String(error.message || error) });
    }
  });

  let port = 0;
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve({ port, token });
    });
  });

  function injectScript() {
    const base = `http://127.0.0.1:${port}`;
    return `(() => {
  const base = ${JSON.stringify(base)};
  const token = ${JSON.stringify(token)};
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  async function invoke(path, method, body) {
    const res = await fetch(base + path, {
      method: method || 'GET',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    if (!res.ok) throw new Error((data && data.error) || text || ('HTTP ' + res.status));
    return data;
  }
  const progressListeners = new Set();
  const logListeners = new Set();
  try {
    const es = new EventSource(base + '/events?token=' + encodeURIComponent(token));
    es.addEventListener('progress', (ev) => {
      let payload = null;
      try { payload = JSON.parse(ev.data); } catch { return; }
      for (const cb of progressListeners) { try { cb(payload); } catch {} }
    });
    es.addEventListener('log', (ev) => {
      let payload = null;
      try { payload = JSON.parse(ev.data); } catch { return; }
      for (const cb of logListeners) { try { cb(payload); } catch {} }
    });
  } catch {}
  const core = {
    overview: () => invoke('/overview'),
    checkHarness: () => invoke('/check'),
    installHarness: (version) => invoke('/install', 'POST', { version }),
    restoreSeed: () => invoke('/restore', 'POST', {}),
    restartHarness: () => invoke('/restart', 'POST', {}),
    checkShellUpdate: () => invoke('/shell-check'),
    installShellUpdate: () => invoke('/shell-install', 'POST', {}),
    cleanup: () => invoke('/cleanup', 'POST', {}),
    diagnose: () => invoke('/diagnose'),
    openPath: (which) => invoke('/open-path', 'POST', { which }).then((r) => r.path),
    onProgress: (callback) => {
      progressListeners.add(callback);
      return () => progressListeners.delete(callback);
    },
    onLog: (callback) => {
      logListeners.add(callback);
      return () => logListeners.delete(callback);
    },
  };
  window.dshDesktop = Object.assign({}, window.dshDesktop || {}, { core: core, bridge: { base: base } });
  window.dispatchEvent(new CustomEvent('dsh-desktop-bridge-ready'));
})();`;
  }

  return {
    ready,
    get port() {
      return port;
    },
    token,
    broadcastProgress(payload) {
      broadcast('progress', payload);
    },
    broadcastLog(entry) {
      broadcast('log', entry);
    },
    injectScript,
    async close() {
      for (const client of sseClients) {
        try {
          client.end();
        } catch {
          // ignore
        }
      }
      sseClients.clear();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

module.exports = { createCoreBridge };
