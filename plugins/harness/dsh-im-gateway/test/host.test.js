import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inject, createToolApprovalHandler } from '../lib/index.js';
import { mountHttp } from '../lib/http.js';
import { createStore } from '../lib/store.js';

test('host plugin injects agents and webServer so the profile can boot', () => {
  assert.ok(inject.includes('agents'), 'needs agents for inbound turns');
  assert.ok(inject.includes('webServer'), 'needs webServer before ctx.webServer');
  assert.ok(inject.includes('agentDefaultModel'), 'needs default model for {{model}}');
});

test('mountHttp registers a prefix route when webServer is present', () => {
  const registered = [];
  const ctx = {
    webServer: {
      register(route) {
        registered.push(route);
        return () => {};
      },
    },
  };
  mountHttp(ctx, { status() { return {}; } });
  assert.equal(registered.length, 1);
  assert.equal(registered[0].kind, 'prefix');
  assert.equal(registered[0].path, '/im-gateway');
});

test('tool approval looks up the WeChat chat by live agent session id', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const store = createStore(dir);
  store.load();
  store.putMapping('weixin:u1', { cwd: dir, sessionId: 'session-abc' });
  const asked = [];
  const handler = createToolApprovalHandler({
    store,
    pipeline: {
      async requestToolApproval(key, userId, info) {
        asked.push({ key, userId, info });
        return 'deny';
      },
    },
  });
  const decision = await handler(
    { agent: { id: 'session-abc' }, name: 'bash', arguments: { cmd: 'ls' } },
    () => ({ kind: 'allow' }),
  );
  assert.equal(decision.kind, 'deny');
  assert.equal(asked[0].key, 'weixin:u1');
  assert.equal(asked[0].info.toolName, 'bash');

  let nextCalled = false;
  await handler({ agent: { id: 'session-other' }, name: 'bash' }, async () => {
    nextCalled = true;
    return { kind: 'allow' };
  });
  assert.equal(nextCalled, true);
});
