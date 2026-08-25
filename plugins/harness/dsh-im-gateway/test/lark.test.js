import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractText, normalizeInbound, createLarkAdapter } from '../lib/adapters/lark.js';
import { createHttpApi, dispatchHttp } from '../lib/http.js';
import { createStore } from '../lib/store.js';

function p2pText(openId, text, extra = {}) {
  return {
    sender: { sender_id: { open_id: openId }, sender_type: extra.senderType || 'user' },
    message: {
      chat_id: extra.chatId || 'oc_dm',
      chat_type: extra.chatType || 'p2p',
      message_type: extra.messageType || 'text',
      content: extra.content || JSON.stringify({ text }),
    },
  };
}

test('normalizeInbound keeps p2p text and drops groups, bots, and empty', () => {
  const ok = normalizeInbound(p2pText('ou_1', 'hello'));
  assert.equal(ok.platform, 'lark');
  assert.equal(ok.userId, 'ou_1');
  assert.equal(ok.chatId, 'oc_dm');
  assert.equal(ok.chatKey, 'lark:ou_1');
  assert.equal(ok.text, 'hello');

  assert.equal(normalizeInbound(p2pText('ou_1', 'hi', { chatType: 'group' })), null);
  assert.equal(normalizeInbound(p2pText('ou_bot', 'hi', { senderType: 'app' })), null);
  assert.equal(normalizeInbound(p2pText('ou_bot', 'hi', { senderType: 'bot' })), null);
  assert.equal(normalizeInbound(p2pText('ou_self', 'hi'), 'ou_self'), null);
  assert.equal(normalizeInbound(p2pText('ou_1', '', { content: JSON.stringify({ text: '  ' }) })), null);
  assert.equal(normalizeInbound(p2pText('ou_1', 'x', { messageType: 'image' })), null);
});

test('extractText reads text and post payloads', () => {
  assert.equal(extractText('text', JSON.stringify({ text: 'hi' })), 'hi');
  assert.equal(
    extractText(
      'post',
      JSON.stringify({
        title: 'T',
        content: [[{ tag: 'text', text: 'hello ' }, { tag: 'text', text: 'world' }]],
      }),
    ),
    'T\nhello world',
  );
});

function fakeLark({ sent = [], starts = [] } = {}) {
  class EventDispatcher {
    constructor(opts) {
      this.opts = opts;
      this.handlers = {};
    }
    register(map) {
      Object.assign(this.handlers, map);
      return this;
    }
  }
  class WSClient {
    constructor(cfg) {
      this.cfg = cfg;
    }
    start({ eventDispatcher }) {
      starts.push({ eventDispatcher, cfg: this.cfg });
      this.dispatcher = eventDispatcher;
      return Promise.resolve();
    }
    close() {
      this.closed = true;
    }
  }
  class Client {
    constructor() {
      this.im = {
        v1: {
          message: {
            create: async (args) => {
              sent.push(args);
              return { code: 0 };
            },
          },
        },
      };
    }
  }
  return { EventDispatcher, WSClient, Client, sent, starts };
}

test('http saves lark config without leaking secrets and toggles the adapter', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const store = createStore(dir);
  store.load();
  const toggles = [];
  const api = createHttpApi({
    store,
    weixin: { getQr: () => null, stop() {}, fetchQr: async () => ({ status: 'wait' }), pollQrOnce: async () => ({ status: 'wait' }) },
    lark: { isConnected: () => true, getError: () => null, stop() {}, start() {} },
    dataDir: dir,
    onPlatformEnabled(id, enabled) {
      toggles.push([id, enabled]);
    },
  });
  const replies = [];
  const res = {
    writeHead() {},
    end(body) {
      replies.push(JSON.parse(body));
    },
  };
  await dispatchHttp({ url: '/im-gateway/status', method: 'GET' }, res, api);
  const listed = replies[0].platforms.find((p) => p.id === 'lark');
  assert.equal(listed.available, true);
  assert.equal(listed.enabled, false);
  await dispatchHttp(
    {
      url: '/im-gateway/platforms/lark',
      method: 'PUT',
      body: JSON.stringify({
        enabled: true,
        appId: 'cli_a',
        appSecret: 'super-secret',
        encryptKey: 'ek',
        verificationToken: 'vt',
      }),
    },
    res,
    api,
  );
  const after = replies[replies.length - 1];
  const row = after.platforms.find((p) => p.id === 'lark');
  assert.equal(row.enabled, true);
  assert.equal(row.appId, 'cli_a');
  assert.equal(row.hasSecret, true);
  assert.equal(row.hasEncryptKey, true);
  assert.equal(row.hasVerificationToken, true);
  assert.equal(row.connected, true);
  assert.equal(row.appSecret, undefined);
  assert.equal(row.encryptKey, undefined);
  assert.equal(row.verificationToken, undefined);
  assert.equal(JSON.stringify(after).includes('super-secret'), false);
  assert.deepEqual(toggles[toggles.length - 1], ['lark', true]);
  assert.equal(store.data.channels.lark.appSecret, 'super-secret');
  await dispatchHttp(
    { url: '/im-gateway/allowlist', method: 'PUT', body: JSON.stringify({ platform: 'lark', userIds: ['ou_1'] }) },
    res,
    api,
  );
  assert.deepEqual(store.data.allowlists.lark, ['ou_1']);
  assert.deepEqual(replies[replies.length - 1].allowlists.lark, ['ou_1']);
});

test('lark adapter start/stop and sendText use the injected SDK', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const store = createStore(dir);
  store.load();
  store.setLarkConfig({ appId: 'cli_a', appSecret: 'sec', encryptKey: 'ek' });
  store.setChannelEnabled('lark', true);
  const inbound = [];
  const sdk = fakeLark();
  const lark = createLarkAdapter({ store, onMessage: (m) => inbound.push(m), Lark: sdk });
  await lark.start();
  assert.equal(lark.isConnected(), true);
  assert.equal(sdk.starts[0].cfg.appId, 'cli_a');
  assert.equal(sdk.starts[0].eventDispatcher.opts.encryptKey, 'ek');
  await sdk.starts[0].eventDispatcher.handlers['im.message.receive_v1'](p2pText('ou_1', 'ping'));
  assert.equal(inbound[0].chatKey, 'lark:ou_1');
  await lark.sendText('ou_1', 'pong');
  assert.equal(sdk.sent[0].params.receive_id_type, 'open_id');
  assert.equal(sdk.sent[0].data.receive_id, 'ou_1');
  assert.equal(sdk.sent[0].data.msg_type, 'text');
  assert.equal(JSON.parse(sdk.sent[0].data.content).text, 'pong');
  lark.stop();
  assert.equal(lark.isConnected(), false);
});
