import fs from 'node:fs';
import path from 'node:path';

function emptyLarkChannel() {
  return {
    enabled: false,
    appId: '',
    appSecret: '',
    encryptKey: '',
    verificationToken: '',
    botOpenId: null,
  };
}

export function emptyState() {
  return {
    version: 1,
    allowlist: [],
    allowlists: { weixin: [], lark: [] },
    mappings: {},
    recentDropped: [],
    credentials: null,
    cursor: { getUpdatesBuf: '' },
    contextTokens: {},
    channels: { weixin: { enabled: true }, lark: emptyLarkChannel() },
  };
}

function uniqueIds(ids) {
  return [...new Set((ids || []).map((x) => String(x).trim()).filter(Boolean))];
}

function migrateAllowlists(parsed) {
  const weixin = uniqueIds(parsed.allowlists?.weixin || parsed.allowlist || []);
  const lark = uniqueIds(parsed.allowlists?.lark || []);
  return { weixin, lark };
}

export function chatKey(platform, userId) {
  return `${platform}:${userId}`;
}

export function createStore(rootDir, io = fs) {
  const dir = rootDir;
  const file = path.join(dir, 'state.json');
  let data = emptyState();

  function load() {
    try {
      if (!io.existsSync(file)) return data;
      const parsed = JSON.parse(io.readFileSync(file, 'utf8'));
      const allowlists = migrateAllowlists(parsed);
      data = {
        ...emptyState(),
        ...parsed,
        mappings: parsed.mappings || {},
        cursor: parsed.cursor || { getUpdatesBuf: '' },
        allowlists,
        allowlist: allowlists.weixin,
        channels: {
          weixin: { enabled: true, ...(parsed.channels?.weixin || {}) },
          lark: { ...emptyLarkChannel(), ...(parsed.channels?.lark || {}) },
        },
      };
    } catch {
      data = emptyState();
    }
    return data;
  }

  function save() {
    io.mkdirSync(dir, { recursive: true });
    io.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    try {
      io.chmodSync(file, 0o600);
    } catch {
      /* windows */
    }
  }

  function persist(mutator) {
    mutator(data);
    save();
    return data;
  }

  return {
    get data() {
      return data;
    },
    load,
    save,
    persist,
    isAllowed(userId, platform = 'weixin') {
      const id = String(userId || '');
      if (!id) return false;
      if (platform === 'weixin' && data.credentials?.userId && id === data.credentials.userId) return true;
      const list = data.allowlists?.[platform] || (platform === 'weixin' ? data.allowlist : []);
      return list.includes(id);
    },
    isChannelEnabled(id) {
      if (id === 'weixin') return data.channels?.weixin?.enabled !== false;
      return Boolean(data.channels?.[id]?.enabled);
    },
    setChannelEnabled(id, enabled) {
      return persist((d) => {
        d.channels = d.channels || {};
        d.channels[id] = { ...d.channels[id], enabled: Boolean(enabled) };
      });
    },
    setAllowlist(ids, platform = 'weixin') {
      return persist((d) => {
        const list = uniqueIds(ids);
        d.allowlists = { weixin: [], lark: [], ...d.allowlists };
        d.allowlists[platform] = list;
        if (platform === 'weixin') d.allowlist = list;
      });
    },
    setLarkConfig(patch) {
      return persist((d) => {
        d.channels = d.channels || {};
        d.channels.lark = { ...emptyLarkChannel(), ...d.channels.lark, ...patch };
      });
    },
    rememberDropped(userId, platform) {
      return persist((d) => {
        const id = String(userId || '');
        d.recentDropped = [
          { userId: id, platform: platform || undefined, at: Date.now() },
          ...d.recentDropped.filter((x) => x.userId !== id),
        ].slice(0, 20);
      });
    },
    getMapping(key) {
      return data.mappings[key] || null;
    },
    findKeyBySessionId(sessionId) {
      if (!sessionId) return null;
      for (const [key, mapping] of Object.entries(data.mappings)) {
        if (mapping?.sessionId === sessionId) return key;
      }
      return null;
    },
    putMapping(key, patch) {
      return persist((d) => {
        d.mappings[key] = { ...d.mappings[key], ...patch, updatedAt: Date.now() };
      });
    },
    deleteMapping(key) {
      return persist((d) => {
        delete d.mappings[key];
      });
    },
    setContextToken(key, token) {
      if (!token) return data;
      return persist((d) => {
        d.contextTokens[key] = token;
      });
    },
    getContextToken(key) {
      return data.contextTokens[key] || '';
    },
    setCredentials(cred) {
      return persist((d) => {
        d.credentials = cred;
        if (!cred) d.cursor = { getUpdatesBuf: '' };
      });
    },
    setCursor(buf) {
      return persist((d) => {
        d.cursor = { getUpdatesBuf: buf || '' };
      });
    },
  };
}
