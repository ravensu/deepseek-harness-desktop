import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessHeaders, extractText, normalizeInbound } from '../lib/adapters/weixin.js';
import { createHttpApi, dispatchHttp } from '../lib/http.js';
import { createStore } from '../lib/store.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('normalizeInbound skips bot echoes and empty text', () => {
  assert.equal(normalizeInbound({ message_type: 2, from_user_id: 'u', item_list: [{ text_item: { text: 'x' } }] }), null);
  assert.equal(
    normalizeInbound(
      { message_type: 1, from_user_id: 'e06@im.bot', item_list: [{ text_item: { text: 'x' } }] },
      'e06@im.bot',
    ),
    null,
  );
  const ownerId = 'o9cq@im.wechat';
  const fromOwner = normalizeInbound(
    { message_type: 1, from_user_id: ownerId, item_list: [{ text_item: { text: 'hi' } }] },
    ownerId,
  );
  assert.equal(fromOwner.userId, ownerId);
  assert.equal(fromOwner.text, 'hi');
  const n = normalizeInbound({
    message_type: 1,
    from_user_id: 'user-1',
    context_token: 'ct',
    item_list: [{ text_item: { text: 'hello' } }],
  });
  assert.equal(n.userId, 'user-1');
  assert.equal(n.text, 'hello');
  assert.equal(n.contextToken, 'ct');
  assert.equal(extractText({ text: 'plain' }), 'plain');
});

test('businessHeaders include bearer token and UIN', () => {
  const h = businessHeaders('tok');
  assert.equal(h.Authorization, 'Bearer tok');
  assert.equal(h.AuthorizationType, 'ilink_bot_token');
  assert.ok(h['X-WECHAT-UIN']);
});

test('http status and allowlist update', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const store = createStore(dir);
  store.load();
  store.setCredentials({ token: 't', botId: 'b' });
  const api = createHttpApi({
    store,
    weixin: { getQr: () => null, stop() {}, fetchQr: async () => ({ status: 'wait' }), pollQrOnce: async () => ({ status: 'wait' }) },
    dataDir: dir,
  });
  const replies = [];
  const res = {
    writeHead() {},
    end(body) {
      replies.push(JSON.parse(body));
    },
  };
  await dispatchHttp({ url: '/im-gateway/status', method: 'GET' }, res, api);
  assert.equal(replies[0].connected, true);
  const weixin = replies[0].platforms.find((p) => p.id === 'weixin');
  const lark = replies[0].platforms.find((p) => p.id === 'lark');
  assert.equal(weixin.connected, true);
  assert.equal(weixin.botId, 'b');
  assert.equal(lark.connected, false);
  assert.equal(lark.available, true);
  assert.deepEqual(
    replies[0].platforms.map((p) => p.id),
    ['weixin', 'lark'],
  );
  assert.equal(weixin.enabled, true);
  await dispatchHttp(
    { url: '/im-gateway/platforms/weixin', method: 'PUT', body: JSON.stringify({ enabled: false }) },
    res,
    api,
  );
  const after = replies[replies.length - 1];
  assert.equal(after.platforms.find((p) => p.id === 'weixin').enabled, false);
  assert.equal(store.isChannelEnabled('weixin'), false);
  await dispatchHttp(
    { url: '/im-gateway/allowlist', method: 'PUT', body: JSON.stringify({ userIds: ['a'] }) },
    res,
    api,
  );
  assert.deepEqual(store.data.allowlist, ['a']);
});
