import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chatKey, createStore } from '../lib/store.js';

test('store persists allowlist, mapping, and credentials', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const a = createStore(dir);
  a.load();
  a.setAllowlist(['u1', 'u1', '']);
  a.putMapping(chatKey('weixin', 'u1'), { cwd: '/tmp/p', sessionId: 's1' });
  a.setCredentials({ token: 't' });
  a.setCursor('buf');
  a.setContextToken('weixin:u1', 'tok');

  const b = createStore(dir);
  b.load();
  assert.deepEqual(b.data.allowlist, ['u1']);
  assert.equal(b.isAllowed('u1'), true);
  assert.equal(b.isAllowed('u2'), false);
  assert.equal(b.getMapping('weixin:u1').cwd, '/tmp/p');
  assert.equal(b.data.credentials.token, 't');
  assert.equal(b.data.cursor.getUpdatesBuf, 'buf');
  assert.equal(b.getContextToken('weixin:u1'), 'tok');
});

test('the WeChat account that scanned login is always allowed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const s = createStore(dir);
  s.load();
  s.setCredentials({ token: 't', botId: 'bot@im.bot', userId: 'me@im.wechat' });
  assert.equal(s.isAllowed('me@im.wechat'), true);
  assert.equal(s.isAllowed('stranger@im.wechat'), false);
});

test('channel enabled defaults on for weixin and can be turned off', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const s = createStore(dir);
  s.load();
  assert.equal(s.isChannelEnabled('weixin'), true);
  assert.equal(s.isChannelEnabled('lark'), false);
  s.setChannelEnabled('weixin', false);
  assert.equal(s.isChannelEnabled('weixin'), false);
});

test('findKeyBySessionId looks up the WeChat mapping for a live agent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const s = createStore(dir);
  s.load();
  s.putMapping(chatKey('weixin', 'u1'), { cwd: '/tmp/p', sessionId: 'session-abc' });
  assert.equal(s.findKeyBySessionId('session-abc'), 'weixin:u1');
  assert.equal(s.findKeyBySessionId('missing'), null);
});

test('lark allowlist is separate from weixin and old allowlist migrates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  fs.writeFileSync(
    path.join(dir, 'state.json'),
    JSON.stringify({
      version: 1,
      allowlist: ['wx-user'],
      mappings: {},
      recentDropped: [],
      credentials: null,
      cursor: { getUpdatesBuf: '' },
      contextTokens: {},
    }),
  );
  const s = createStore(dir);
  s.load();
  assert.equal(s.isAllowed('wx-user'), true);
  assert.equal(s.isAllowed('wx-user', 'weixin'), true);
  assert.equal(s.isAllowed('wx-user', 'lark'), false);
  s.setAllowlist(['ou_1'], 'lark');
  assert.equal(s.isAllowed('ou_1', 'lark'), true);
  assert.equal(s.isAllowed('ou_1', 'weixin'), false);
});

test('lark credentials persist without mixing into weixin credentials', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const s = createStore(dir);
  s.load();
  s.setLarkConfig({ appId: 'cli_a', appSecret: 'sec', encryptKey: 'ek', verificationToken: 'vt' });
  const b = createStore(dir);
  b.load();
  assert.equal(b.data.channels.lark.appId, 'cli_a');
  assert.equal(b.data.channels.lark.appSecret, 'sec');
  assert.equal(b.data.channels.lark.encryptKey, 'ek');
  assert.equal(b.data.channels.lark.verificationToken, 'vt');
  assert.equal(b.data.credentials, null);
});

test('rememberDropped keeps unique newest-first cap', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const s = createStore(dir);
  s.load();
  s.rememberDropped('a');
  s.rememberDropped('b');
  s.rememberDropped('a');
  assert.equal(s.data.recentDropped[0].userId, 'a');
  assert.equal(s.data.recentDropped.length, 2);
});
