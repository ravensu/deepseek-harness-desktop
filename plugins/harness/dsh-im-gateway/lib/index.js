import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAgentBridge } from './agent-bridge.js';
import { createApprovals } from './approvals.js';
import { createPipeline } from './pipeline.js';
import { createProgress } from './progress.js';
import { createHttpApi, mountHttp } from './http.js';
import { createStore } from './store.js';
import { createWeixinAdapter } from './adapters/weixin.js';
import { createLarkAdapter } from './adapters/lark.js';

export const name = 'im-gateway';
export const inject = ['agents', 'webServer', 'agentDefaultModel'];

function resolveDshHome(ctx) {
  return process.env.DSH_HOME || ctx?.paths?.home || ctx?.dshHome || path.join(os.homedir(), '.dsh');
}

function resolveDataDir(ctx) {
  return path.join(resolveDshHome(ctx), 'im-gateway');
}

function resolveWorkspaceDir(ctx) {
  const dir = path.join(resolveDshHome(ctx), 'workspace');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function createToolApprovalHandler({ store, pipeline }) {
  return async (exec, next) => {
    const sessionId = exec?.agent?.id || exec?.agent?.session?.id || '';
    const imKey = store.findKeyBySessionId(sessionId);
    if (!imKey) {
      if (typeof next === 'function') return next();
      return;
    }
    const userId = String(imKey).slice(String(imKey).indexOf(':') + 1);
    const decision = await pipeline.requestToolApproval(imKey, userId, {
      toolName: exec?.name || 'tool',
      argsPreview: JSON.stringify(exec?.arguments ?? {}).slice(0, 500),
      policy: 'ask',
    });
    if (decision === 'deny') {
      return { kind: 'deny', reason: 'User denied tool from WeChat' };
    }
    if (typeof next === 'function') return next();
    return { kind: 'allow' };
  };
}

function attachToolApproval(ctx, pipeline, store, log) {
  const handler = createToolApprovalHandler({ store, pipeline });
  try {
    ctx.on?.('tools/pre-execute', handler);
  } catch (err) {
    log.warn?.('[dsh-im-gateway] cannot hook tools/pre-execute', err);
  }
}

export function apply(ctx) {
  const log = ctx.logger || console;
  const dataDir = resolveDataDir(ctx);
  fs.mkdirSync(dataDir, { recursive: true });
  const store = createStore(dataDir);
  store.load();
  const owner = store.data.credentials?.userId;
  if (owner && !store.data.allowlist.includes(owner)) {
    store.setAllowlist([...store.data.allowlist, owner]);
  }

  let weixin;
  let lark;

  const send = async ({ chatKey, userId, text }) => {
    if (String(chatKey).startsWith('lark:')) {
      return lark.sendText(userId, text);
    }
    const token = store.getContextToken(chatKey);
    await weixin.sendText(userId, text, token);
  };

  const progress = createProgress({
    send: (key, text) => {
      const userId = String(key).replace(/^[^:]+:/, '');
      return send({ chatKey: key, userId, text });
    },
  });
  const approvals = createApprovals();
  let agentsApi;
  try {
    const bridge = createAgentBridge(ctx);
    agentsApi = {
      createSession: ({ chatKey, cwd }) => bridge.createSession({ chatKey, cwd }),
      runTurn: (input) => bridge.runTurn(input),
      cancel: (sessionId) => bridge.cancel(sessionId),
    };
  } catch (err) {
    log.warn?.('[dsh-im-gateway] agents API unavailable, inbound turns disabled', err);
    agentsApi = {
      async createSession() {
        throw new Error('agents unavailable');
      },
      async runTurn() {
        throw new Error('agents unavailable');
      },
      async cancel() {},
    };
  }

  const pipeline = createPipeline({
    store,
    approvals,
    progress,
    agents: agentsApi,
    send,
    log,
    defaultCwd: resolveWorkspaceDir(ctx),
  });

  weixin = createWeixinAdapter({
    store,
    log,
    onMessage: (inbound) => pipeline.handleInbound(inbound),
  });
  lark = createLarkAdapter({
    store,
    log,
    onMessage: (inbound) => pipeline.handleInbound(inbound),
  });

  attachToolApproval(ctx, pipeline, store, log);

  const syncPlatform = (id, enabled) => {
    try {
      if (id === 'weixin') {
        if (enabled) weixin.start();
        else weixin.stop();
      }
      if (id === 'lark') {
        if (enabled) void lark.start();
        else lark.stop();
      }
    } catch (err) {
      log.warn?.(`[dsh-im-gateway] ${id} toggle failed`, err);
    }
  };

  const api = createHttpApi({
    store,
    weixin,
    lark,
    dataDir,
    onPlatformEnabled: syncPlatform,
  });
  mountHttp(ctx, api);

  if (store.isChannelEnabled('weixin')) {
    try {
      weixin.start();
    } catch (err) {
      log.warn?.('[dsh-im-gateway] weixin start failed', err);
    }
  }
  if (store.isChannelEnabled('lark')) {
    void lark.start().catch((err) => log.warn?.('[dsh-im-gateway] lark start failed', err));
  }

  ctx.on?.('dispose', () => {
    weixin.stop();
    lark.stop();
  });
}

export { createStore, createPipeline, createApprovals, createProgress };
