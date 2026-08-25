import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chatKey } from '../store.js';

export function extractText(messageType, content) {
  let parsed = content;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return String(content || '').trim();
    }
  }
  if (!parsed || typeof parsed !== 'object') return String(parsed || '').trim();
  if (messageType === 'text' || (parsed.text != null && parsed.content == null)) {
    return String(parsed.text || '').trim();
  }
  const title = String(parsed.title || '').trim();
  const parts = [];
  for (const row of parsed.content || []) {
    for (const cell of row || []) {
      if (cell?.text) parts.push(cell.text);
    }
  }
  const body = parts.join('').trim();
  return [title, body].filter(Boolean).join('\n');
}

export function normalizeInbound(event, botOpenId) {
  const data = event?.message ? event : event?.event || event;
  const message = data?.message;
  const sender = data?.sender;
  if (!message) return null;
  if (message.chat_type !== 'p2p') return null;
  const senderType = sender?.sender_type || '';
  if (senderType === 'app' || senderType === 'bot') return null;
  const userId = sender?.sender_id?.open_id || sender?.sender_id?.user_id || '';
  if (!userId) return null;
  if (botOpenId && userId === botOpenId) return null;
  const messageType = message.message_type || message.msg_type;
  if (messageType !== 'text' && messageType !== 'post') return null;
  const text = extractText(messageType, message.content);
  if (!text) return null;
  return {
    platform: 'lark',
    userId,
    chatId: message.chat_id || '',
    chatKey: chatKey('lark', userId),
    text,
  };
}

function findSdkDir() {
  let dir = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
  for (let i = 0; i < 16; i++) {
    const candidate = path.join(dir, 'node_modules', '@larksuiteoapi', 'node-sdk');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function loadSdk(Lark) {
  if (Lark) return Lark;
  try {
    return await import('@larksuiteoapi/node-sdk');
  } catch {
    const dir = findSdkDir();
    if (!dir) throw new Error('cannot find @larksuiteoapi/node-sdk');
    return import(pathToFileURL(path.join(dir, 'es/index.js')).href);
  }
}

export function createLarkAdapter({ store, log = console, onMessage, Lark }) {
  let wsClient = null;
  let restClient = null;
  let connected = false;
  let error = null;

  function config() {
    return store.data.channels?.lark || {};
  }

  async function start() {
    stop();
    const cfg = config();
    if (!store.isChannelEnabled('lark')) return;
    if (!cfg.appId || !cfg.appSecret) {
      error = 'missing app credentials';
      return;
    }
    let sdk;
    try {
      sdk = await loadSdk(Lark);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      log.warn?.('[dsh-im-gateway] lark sdk missing', err);
      return;
    }
    const dispatcher = new sdk.EventDispatcher({
      encryptKey: cfg.encryptKey || undefined,
      verificationToken: cfg.verificationToken || undefined,
    }).register({
      'im.message.receive_v1': async (data) => {
        const inbound = normalizeInbound(data, store.data.channels?.lark?.botOpenId);
        if (!inbound) return;
        try {
          await onMessage?.(inbound);
        } catch (err) {
          log.warn?.('[dsh-im-gateway] lark inbound handler failed', err);
        }
      },
    });
    restClient = new sdk.Client({ appId: cfg.appId, appSecret: cfg.appSecret });
    wsClient = new sdk.WSClient({ appId: cfg.appId, appSecret: cfg.appSecret });
    error = null;
    connected = true;
    try {
      const started = wsClient.start({ eventDispatcher: dispatcher });
      if (started && typeof started.then === 'function') {
        started.catch((err) => {
          connected = false;
          error = err instanceof Error ? err.message : String(err);
          log.warn?.('[dsh-im-gateway] lark ws failed', err);
        });
      }
    } catch (err) {
      connected = false;
      error = err instanceof Error ? err.message : String(err);
      log.warn?.('[dsh-im-gateway] lark start failed', err);
    }
    try {
      const info = await restClient?.bot?.v3?.info?.get?.();
      const openId = info?.data?.bot?.open_id || info?.bot?.open_id;
      if (openId) store.setLarkConfig({ botOpenId: openId });
    } catch {
      /* optional */
    }
  }

  function stop() {
    connected = false;
    try {
      wsClient?.close?.();
      wsClient?.stop?.();
    } catch {
      /* ignore */
    }
    wsClient = null;
  }

  async function sendText(userId, text) {
    if (!restClient) {
      const cfg = config();
      const sdk = await loadSdk(Lark);
      restClient = new sdk.Client({ appId: cfg.appId, appSecret: cfg.appSecret });
    }
    return restClient.im.v1.message.create({
      params: { receive_id_type: 'open_id' },
      data: {
        receive_id: userId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
  }

  return {
    capabilities: { buttons: false, editMessage: false, groups: false },
    start,
    stop,
    sendText,
    isConnected: () => connected,
    getError: () => error,
  };
}
