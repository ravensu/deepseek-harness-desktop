import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApprovals } from '../lib/approvals.js';
import { createPipeline } from '../lib/pipeline.js';
import { createProgress } from '../lib/progress.js';
import { createStore } from '../lib/store.js';

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'im-cwd-'));
  const store = createStore(dir);
  store.load();
  const sent = [];
  const turns = [];
  const pipeline = createPipeline({
    store,
    approvals: createApprovals({ timeoutMs: 60_000 }),
    progress: createProgress({ send: (k, t) => sent.push(['p', k, t]) }),
    send: async ({ chatKey, text }) => sent.push(['s', chatKey, text]),
    agents: {
      async createSession({ cwd: c }) {
        return { sessionId: `sess-${c}` };
      },
      async runTurn(input) {
        turns.push(input);
        input.onTool?.('bash');
        return { sessionId: input.sessionId || 'sess-run', text: `echo:${input.text}` };
      },
      async cancel() {},
    },
  });
  return { store, sent, turns, pipeline, cwd };
}

function inbound(userId, text, extra = {}) {
  return { platform: 'weixin', userId, text, ...extra };
}

test('unknown users are dropped with no outbound', async () => {
  const { pipeline, store, sent } = setup();
  const r = await pipeline.handleInbound(inbound('u1', 'hi'));
  assert.equal(r.dropped, true);
  assert.equal(sent.length, 0);
  assert.equal(store.data.recentDropped[0].userId, 'u1');
});

test('allowed user without cwd uses defaultCwd and runs a turn', async () => {
  const { store, sent, turns, cwd } = setup();
  store.setAllowlist(['u1']);
  const pipeline = createPipeline({
    store,
    approvals: createApprovals({ timeoutMs: 60_000 }),
    progress: createProgress({ send: (k, t) => sent.push(['p', k, t]) }),
    send: async ({ chatKey, text }) => sent.push(['s', chatKey, text]),
    defaultCwd: cwd,
    agents: {
      async createSession({ cwd: c }) {
        return { sessionId: `sess-${c}` };
      },
      async runTurn(input) {
        turns.push(input);
        return { sessionId: input.sessionId || 'sess-run', text: `echo:${input.text}` };
      },
      async cancel() {},
    },
  });
  const r = await pipeline.handleInbound(inbound('u1', 'hello'));
  assert.equal(r.ok, true);
  assert.equal(store.getMapping('weixin:u1').cwd, path.resolve(cwd));
  assert.equal(turns.length, 1);
  assert.equal(turns[0].cwd, path.resolve(cwd));
  assert.equal(turns[0].text, 'hello');
});

test('allowed user without cwd and without defaultCwd still gets bind help', async () => {
  const { pipeline, store, sent, turns } = setup();
  store.setAllowlist(['u1']);
  const r = await pipeline.handleInbound(inbound('u1', 'fix the bug'));
  assert.equal(r.needCwd, true);
  assert.equal(turns.length, 0);
  assert.match(sent[0][2], /\/cwd/);
});

test('/cwd binds an existing directory and later text runs a turn', async () => {
  const { pipeline, store, sent, turns, cwd } = setup();
  store.setAllowlist(['u1']);
  await pipeline.handleInbound(inbound('u1', `/cwd ${cwd}`));
  assert.equal(store.getMapping('weixin:u1').cwd, path.resolve(cwd));
  const r = await pipeline.handleInbound(inbound('u1', 'list files'));
  assert.equal(r.ok, true);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, 'list files');
  assert.ok(sent.some((row) => String(row[2]).includes('echo:list files')));
});

test('lark users are not admitted by the weixin allowlist', async () => {
  const { pipeline, store, sent } = setup();
  store.setAllowlist(['ou_1']);
  const dropped = await pipeline.handleInbound({
    platform: 'lark',
    userId: 'ou_1',
    chatKey: 'lark:ou_1',
    text: 'hi',
  });
  assert.equal(dropped.dropped, true);
  assert.equal(sent.length, 0);
  store.setAllowlist(['ou_1'], 'lark');
  const r = await pipeline.handleInbound({
    platform: 'lark',
    userId: 'ou_1',
    chatKey: 'lark:ou_1',
    text: 'hi',
  });
  assert.equal(r.needCwd, true);
});
