import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgentBridge } from '../lib/agent-bridge.js';

function hostLikeAgents() {
  const live = new Map();
  const creates = [];
  const resumes = [];
  const handlers = new Map();

  const ctx = {
    on(event, fn) {
      const list = handlers.get(event) || [];
      list.push(fn);
      handlers.set(event, list);
      return () => {
        handlers.set(
          event,
          (handlers.get(event) || []).filter((x) => x !== fn),
        );
      };
    },
    emit(event, ...args) {
      for (const fn of handlers.get(event) || []) fn(...args);
    },
    get(name) {
      const desc = Object.getOwnPropertyDescriptor(ctx, name);
      if (desc && Object.prototype.hasOwnProperty.call(desc, 'value')) return desc.value;
      return undefined;
    },
  };

  function makeAgent(id) {
    const session = { id };
    const agentCtx = {
      on() {
        return () => {};
      },
    };
    const agent = {
      id,
      session,
      ctx: agentCtx,
      followups: [],
      idleCalls: 0,
      followup(message) {
        agent.followups.push(message);
        ctx.emit('session/event', session, {
          type: 'tool/call',
          data: { name: 'bash' },
        });
        ctx.emit('session/event', session, {
          type: 'assistant/message',
          data: {
            message: {
              content: [{ type: 'text', text: `echo:${message.content[0].text}` }],
            },
          },
        });
      },
      async whenIdle() {
        agent.idleCalls += 1;
      },
      cancel() {},
    };
    return agent;
  }

  ctx.agents = {
    get(id) {
      return live.get(id);
    },
    async create(options) {
      creates.push(options);
      if (!options?.sessionId) {
        throw new Error('agent id "undefined" does not match session id "session-1"');
      }
      const agent = makeAgent(options.sessionId);
      live.set(options.sessionId, agent);
      return { agent, async dispose() {} };
    },
    async resume(options) {
      resumes.push(options);
      const id = options.resumeSessionId;
      if (live.has(id)) throw new Error(`agent "${id}" is already registered`);
      const agent = makeAgent(id);
      live.set(id, agent);
      return { agent, async dispose() {} };
    },
  };

  return { ctx, creates, resumes, live };
}

test('runTurn mints a sessionId so create does not throw the host identity mismatch', async () => {
  const { ctx, creates } = hostLikeAgents();
  const bridge = createAgentBridge(ctx);
  const result = await bridge.runTurn({ chatKey: 'weixin:u1', cwd: '/tmp/p', text: 'hello' });
  assert.equal(creates.length, 1);
  assert.equal(typeof creates[0].sessionId, 'string');
  assert.ok(creates[0].sessionId.startsWith('session-'));
  assert.notEqual(creates[0].sessionId, 'session-1');
  assert.equal(creates[0].meta.cwd, '/tmp/p');
  assert.equal(result.sessionId, creates[0].sessionId);
  assert.equal(result.text, 'echo:hello');
});

test('runTurn unwraps AgentHandle and sends a UserMessage then waits until idle', async () => {
  const { ctx, live } = hostLikeAgents();
  const bridge = createAgentBridge(ctx);
  const result = await bridge.runTurn({ chatKey: 'weixin:u1', cwd: '/tmp/p', text: 'hello' });
  const agent = live.get(result.sessionId);
  assert.ok(agent);
  assert.equal(agent.followups.length, 1);
  const msg = agent.followups[0];
  assert.equal(msg.role, 'user');
  assert.equal(msg.source.kind, 'user');
  assert.equal(msg.content[0].type, 'text');
  assert.equal(msg.content[0].text, 'hello');
  assert.equal(agent.idleCalls, 1);
});

test('runTurn passes the default model so prompt {{model}} has a value', async () => {
  const { ctx, creates } = hostLikeAgents();
  ctx.agentDefaultModel = {
    currentSelection() {
      return { provider: 'deepseek', model: 'deepseek-v4-flash' };
    },
  };
  const bridge = createAgentBridge(ctx);
  await bridge.runTurn({ chatKey: 'weixin:u1', cwd: '/tmp/p', text: 'hello' });
  assert.equal(creates[0].agentOptions.provider, 'deepseek');
  assert.equal(creates[0].agentOptions.model, 'deepseek-v4-flash');
  assert.equal(typeof creates[0].setup, 'function');
});

test('create setup mounts the default agent preset', async () => {
  const { ctx, creates } = hostLikeAgents();
  ctx.agentDefaultModel = {
    currentSelection() {
      return { provider: 'deepseek', model: 'deepseek-v4-flash' };
    },
  };
  const mounted = [];
  ctx.agentPresets = {
    async resolve() {
      return { id: 'standard' };
    },
    async mount(_agentCtx, id) {
      mounted.push(id);
    },
  };
  const bridge = createAgentBridge(ctx);
  await bridge.runTurn({ chatKey: 'weixin:u1', cwd: '/tmp/p', text: 'hello' });
  assert.equal(creates[0].meta.agentPreset, 'standard');
  await creates[0].setup({
    agent: { options: creates[0].agentOptions },
    on() {
      return () => {};
    },
  });
  assert.deepEqual(mounted, ['standard']);
});

test('runTurn replaces a live agent that was created without a model', async () => {
  const { ctx, creates, live } = hostLikeAgents();
  ctx.agentDefaultModel = {
    currentSelection() {
      return { provider: 'deepseek', model: 'deepseek-v4-flash' };
    },
  };
  live.set('session-stale', {
    id: 'session-stale',
    session: { id: 'session-stale' },
    options: {},
    ctx,
    followups: [],
    followup() {},
    async whenIdle() {},
  });
  const bridge = createAgentBridge(ctx);
  const result = await bridge.runTurn({
    chatKey: 'weixin:u1',
    cwd: '/tmp/p',
    sessionId: 'session-stale',
    text: 'hello',
  });
  assert.equal(creates.length, 1);
  assert.notEqual(result.sessionId, 'session-stale');
  assert.equal(creates[0].agentOptions.model, 'deepseek-v4-flash');
});

test('runTurn reuses a live agent instead of creating a second session', async () => {
  const { ctx, creates, resumes } = hostLikeAgents();
  const bridge = createAgentBridge(ctx);
  const first = await bridge.runTurn({ chatKey: 'weixin:u1', cwd: '/tmp/p', text: 'hello' });
  const second = await bridge.runTurn({
    chatKey: 'weixin:u1',
    cwd: '/tmp/p',
    sessionId: first.sessionId,
    text: 'again',
  });
  assert.equal(creates.length, 1);
  assert.equal(resumes.length, 0);
  assert.equal(second.sessionId, first.sessionId);
  assert.equal(second.text, 'echo:again');
});

test('runTurn reads default model via ctx.get so Cordis inject does not throw', async () => {
  const { ctx, creates } = hostLikeAgents();
  Object.defineProperty(ctx, 'agentDefaultModel', {
    configurable: true,
    get() {
      throw new Error('cannot get property "agentDefaultModel" without inject');
    },
  });
  ctx.get = (name) => {
    if (name === 'agentDefaultModel') {
      return {
        currentSelection() {
          return { provider: 'deepseek', model: 'deepseek-v4-flash' };
        },
      };
    }
    return undefined;
  };
  const bridge = createAgentBridge(ctx);
  await bridge.runTurn({ chatKey: 'weixin:u1', cwd: '/tmp/p', text: 'hello' });
  assert.equal(creates[0].agentOptions.model, 'deepseek-v4-flash');
});
