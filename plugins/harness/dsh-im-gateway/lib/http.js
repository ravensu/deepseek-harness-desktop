async function readBody(req) {
  if (req.body != null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body || '{}');
      } catch {
        return {};
      }
    }
    if (typeof req.body === 'object') return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  if (typeof res.json === 'function') {
    res.statusCode = status;
    return res.json(payload);
  }
  res.writeHead?.(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

export async function dispatchHttp(req, res, api) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const method = (req.method || 'GET').toUpperCase();
  const p = url.pathname.replace(/\/$/, '') || '/';

  try {
    if (p === '/im-gateway/status' && method === 'GET') {
      return json(res, 200, api.status());
    }
    if (p === '/im-gateway/login' && method === 'POST') {
      return json(res, 200, await api.startLogin());
    }
    if (p === '/im-gateway/login' && method === 'GET') {
      return json(res, 200, await api.loginStatus());
    }
    if (p === '/im-gateway/logout' && method === 'POST') {
      return json(res, 200, api.logout());
    }
    if ((p === '/im-gateway/allowlist' || p === '/im-gateway/allowlist') && method === 'PUT') {
      const body = await readBody(req);
      return json(res, 200, api.setAllowlist(body.userIds || body.allowlist || [], body.platform || 'weixin'));
    }
    if (p.startsWith('/im-gateway/platforms/') && method === 'PUT') {
      const id = decodeURIComponent(p.slice('/im-gateway/platforms/'.length));
      const body = await readBody(req);
      return json(res, 200, api.setPlatformEnabled(id, body));
    }
    if (p.startsWith('/im-gateway/mappings/') && method === 'DELETE') {
      const key = decodeURIComponent(p.slice('/im-gateway/mappings/'.length));
      return json(res, 200, api.deleteMapping(key));
    }
    return json(res, 404, { error: 'not found' });
  } catch (err) {
    const status = Number(err?.status) || 500;
    return json(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
}

export function listPlatforms(store, { lark } = {}) {
  const cred = store.data.credentials;
  const weixinEnabled = store.isChannelEnabled('weixin');
  const weixinConnected = Boolean(cred?.token) && weixinEnabled;
  const larkCfg = store.data.channels?.lark || {};
  const larkEnabled = store.isChannelEnabled('lark');
  const larkReady = Boolean(larkCfg.appId && larkCfg.appSecret);
  return [
    {
      id: 'weixin',
      available: true,
      enabled: weixinEnabled,
      connected: weixinConnected,
      botId: cred?.botId || null,
    },
    {
      id: 'lark',
      available: true,
      enabled: larkEnabled,
      connected: larkEnabled && larkReady && Boolean(lark?.isConnected?.()),
      botId: larkCfg.botOpenId || null,
      appId: larkCfg.appId || '',
      hasSecret: Boolean(larkCfg.appSecret),
      hasEncryptKey: Boolean(larkCfg.encryptKey),
      hasVerificationToken: Boolean(larkCfg.verificationToken),
      error: lark?.getError?.() || null,
    },
  ];
}

export function createHttpApi({ store, weixin, lark, dataDir, onPlatformEnabled }) {
  function snapshot() {
    const platforms = listPlatforms(store, { lark });
    const weixinRow = platforms.find((p) => p.id === 'weixin') || {};
    return {
      connected: Boolean(weixinRow.connected),
      botId: weixinRow.botId || null,
      allowlist: store.data.allowlist,
      allowlists: store.data.allowlists,
      mappings: store.data.mappings,
      recentDropped: store.data.recentDropped,
      qr: weixin.getQr?.() || null,
      dataDir,
      platforms,
    };
  }

  return {
    status() {
      return snapshot();
    },
    setPlatformEnabled(id, body = {}) {
      if (id !== 'weixin' && id !== 'lark') {
        const err = new Error('platform not configurable yet');
        err.status = 400;
        throw err;
      }
      const payload = typeof body === 'boolean' || body == null ? { enabled: body } : body;
      if (id === 'lark') {
        const patch = {};
        if (payload.appId != null) patch.appId = String(payload.appId);
        if (payload.appSecret) patch.appSecret = String(payload.appSecret);
        if (payload.encryptKey != null) patch.encryptKey = String(payload.encryptKey);
        if (payload.verificationToken != null) patch.verificationToken = String(payload.verificationToken);
        if (Object.keys(patch).length) store.setLarkConfig(patch);
      }
      if (payload.enabled != null) store.setChannelEnabled(id, payload.enabled);
      onPlatformEnabled?.(id, store.isChannelEnabled(id));
      return snapshot();
    },
    async startLogin() {
      weixin.stop();
      return weixin.fetchQr();
    },
    async loginStatus() {
      const qr = await weixin.pollQrOnce();
      if (qr?.status === 'confirmed' && store.isChannelEnabled('weixin')) {
        weixin.start();
      }
      return qr;
    },
    logout() {
      weixin.stop();
      store.setCredentials(null);
      return { ok: true };
    },
    setAllowlist(ids, platform = 'weixin') {
      store.setAllowlist(ids, platform);
      return { allowlist: store.data.allowlist, allowlists: store.data.allowlists };
    },
    deleteMapping(key) {
      store.deleteMapping(key);
      return { ok: true };
    },
  };
}

export function mountHttp(ctx, api) {
  const handler = (req, res) => dispatchHttp(req, res, api);
  const server = ctx.webServer;
  if (server?.register) {
    try {
      return server.register({
        name: 'im-gateway',
        kind: 'prefix',
        path: '/im-gateway',
        handler,
      });
    } catch (err) {
      ctx.logger?.warn?.('[dsh-im-gateway] webServer.register failed', err);
    }
  }
  if (typeof server?.use === 'function') {
    server.use('/im-gateway', handler);
  }
}
