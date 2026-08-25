import crypto from 'node:crypto';
import { chatKey } from '../store.js';

export const DEFAULT_BASE = 'https://ilinkai.weixin.qq.com';
export const CHANNEL_VERSION = '1.0.0';

export function randomWechatUin() {
  const value = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(value), 'utf8').toString('base64');
}

export function businessHeaders(token) {
  return {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token',
    Authorization: `Bearer ${token}`,
    'X-WECHAT-UIN': randomWechatUin(),
  };
}

export function isBotAccount(id) {
  return String(id || '').includes('@im.bot');
}

export function resolveBotId(cred) {
  if (cred?.botId && isBotAccount(cred.botId)) return cred.botId;
  const token = String(cred?.token || '');
  const m = token.match(/^[^:]+\@im\.bot/);
  return m ? m[0] : '';
}

export function credentialsFromQr(json, baseUrl = DEFAULT_BASE) {
  const userId = json.ilink_user_id || json.user_id || '';
  const botId =
    json.ilink_bot_id || json.bot_id || (isBotAccount(userId) ? userId : '');
  return {
    token: json.bot_token || json.token,
    botId,
    userId,
    baseUrl: json.base_url || json.baseurl || baseUrl,
    savedAt: new Date().toISOString(),
  };
}

export function extractText(msg) {
  const items = msg?.item_list || msg?.items || [];
  const parts = [];
  for (const item of items) {
    const text = item?.text_item?.text || item?.text?.text || '';
    if (text) parts.push(text);
  }
  if (!parts.length && msg?.text) parts.push(String(msg.text));
  return parts.join('\n').trim();
}

export function normalizeInbound(msg, botId) {
  const userId = msg?.from_user_id || msg?.from_userid || '';
  const type = msg?.message_type ?? msg?.msg_type;
  if (type === 2) return null;
  if (isBotAccount(userId)) return null;
  if (botId && isBotAccount(botId) && userId === botId) return null;
  const text = extractText(msg);
  if (!userId || !text) return null;
  return {
    platform: 'weixin',
    userId,
    chatId: userId,
    chatKey: chatKey('weixin', userId),
    text,
    contextToken: msg.context_token || msg.contextToken || '',
    raw: msg,
  };
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, httpStatus: res.status };
  }
}

export function createWeixinAdapter({
  fetchImpl = globalThis.fetch,
  store,
  onMessage,
  log = console,
  baseUrl = DEFAULT_BASE,
  pollTimeoutMs = 35_000,
}) {
  let stopped = false;
  let loopPromise = null;
  let qr = null;

  async function request(pathname, { method = 'POST', token, body, timeoutMs } = {}) {
    const url = pathname.startsWith('http') ? pathname : `${baseUrl}${pathname}`;
    const headers = token ? businessHeaders(token) : { 'Content-Type': 'application/json' };
    const ac = new AbortController();
    const timer = timeoutMs ? setTimeout(() => ac.abort(), timeoutMs) : null;
    try {
      const res = await fetchImpl(url, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
        signal: ac.signal,
      });
      const json = await readJson(res);
      json.httpStatus = res.status;
      return json;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function sessionExpired(json) {
    return json?.ret === -14 || json?.errcode === -14;
  }

  async function expire() {
    store.setCredentials(null);
    qr = null;
    log.warn?.('[dsh-im-gateway] weixin session expired, scan again');
  }

  async function fetchQr() {
    const json = await request('/ilink/bot/get_bot_qrcode?bot_type=3', { method: 'GET' });
    qr = {
      qrcode: json.qrcode,
      payload: json.qrcode_img_content || json.qrcode,
      status: 'wait',
      error: json.errmsg || null,
    };
    return qr;
  }

  async function pollQrOnce() {
    if (!qr?.qrcode) return fetchQr();
    const json = await request(
      `/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qr.qrcode)}`,
      { method: 'GET', timeoutMs: pollTimeoutMs },
    );
    const status = json.status || (json.bot_token ? 'confirmed' : 'wait');
    if (status === 'expired') return fetchQr();
    if (status === 'confirmed' && json.bot_token) {
      const cred = credentialsFromQr(json, baseUrl);
      store.setCredentials(cred);
      if (cred.userId && !store.isAllowed(cred.userId)) {
        store.setAllowlist([...store.data.allowlist, cred.userId]);
      }
      qr = { status: 'confirmed' };
      startPolling();
      return qr;
    }
    qr = { ...qr, status };
    return qr;
  }

  async function sendText(userId, text, contextToken) {
    const cred = store.data.credentials;
    if (!cred?.token) throw new Error('weixin not logged in');
    const json = await request('/ilink/bot/sendmessage', {
      token: cred.token,
      body: {
        msg: {
          from_user_id: '',
          to_user_id: userId,
          client_id: `dsh:${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          message_type: 2,
          message_state: 2,
          context_token: contextToken,
          item_list: [{ type: 1, text_item: { text } }],
        },
        base_info: { channel_version: CHANNEL_VERSION },
      },
    });
    if (sessionExpired(json)) {
      await expire();
      throw new Error('weixin session expired');
    }
    return json;
  }

  async function pollOnce() {
    const cred = store.data.credentials;
    if (!cred?.token) return;
    let json;
    try {
      json = await request('/ilink/bot/getupdates', {
        token: cred.token,
        timeoutMs: pollTimeoutMs + 5_000,
        body: {
          get_updates_buf: store.data.cursor?.getUpdatesBuf || '',
          base_info: { channel_version: CHANNEL_VERSION },
        },
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      throw err;
    }
    if (sessionExpired(json)) {
      await expire();
      return;
    }
    if (json.ret && json.ret !== 0) {
      throw new Error(json.errmsg || `getupdates ret=${json.ret}`);
    }
    if (json.get_updates_buf) store.setCursor(json.get_updates_buf);
    const msgs = json.msgs || json.messages || [];
    for (const msg of msgs) {
      const inbound = normalizeInbound(msg, resolveBotId(cred));
      if (!inbound) continue;
      try {
        await onMessage?.(inbound);
      } catch (err) {
        log.warn?.('[dsh-im-gateway] inbound handler failed', err);
      }
    }
  }

  async function loop() {
    let fail = 0;
    while (!stopped && store.data.credentials?.token) {
      try {
        await pollOnce();
        fail = 0;
      } catch (err) {
        fail += 1;
        log.warn?.('[dsh-im-gateway] poll failed', err);
        await new Promise((r) => setTimeout(r, fail >= 3 ? 30_000 : 2_000));
      }
    }
  }

  function startPolling() {
    if (loopPromise || !store.data.credentials?.token || stopped) return;
    loopPromise = loop().finally(() => {
      loopPromise = null;
    });
  }

  function start() {
    stopped = false;
    if (store.data.credentials?.token) startPolling();
  }

  function stop() {
    stopped = true;
  }

  return {
    capabilities: { buttons: false, editMessage: false, groups: false },
    start,
    stop,
    fetchQr,
    pollQrOnce,
    getQr: () => qr,
    sendText,
    pollOnce,
    request,
  };
}
