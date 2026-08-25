import { randomUUID } from 'node:crypto';

function mintSessionId() {
  return `session-${randomUUID()}`;
}

function unwrapAgent(value) {
  if (!value) return value;
  if (value.agent && (typeof value.agent.followup === 'function' || value.agent.session)) {
    return value.agent;
  }
  return value;
}

function sessionIdOf(value) {
  const agent = unwrapAgent(value);
  return agent?.id || agent?.session?.id || value?.sessionId || '';
}

function userMessage(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: String(text ?? '') }],
    source: { kind: 'user' },
  };
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      if (typeof block === 'string') return block;
      if (block?.type === 'text') return block.text || '';
      return '';
    })
    .filter(Boolean)
    .join('');
}

function collectText(event) {
  const t = event?.type || event?.kind || '';
  if (t !== 'assistant/message' && t !== 'assistant_message') return '';
  const data = event.data || event;
  const message = data.message || data;
  return textFromContent(message.content) || data.text || event.text || '';
}

function toolNameOf(event) {
  const t = event?.type || event?.kind || '';
  if (t !== 'tool/call' && t !== 'tool_call') return '';
  return event.data?.name || event.name || event.tool || '';
}

function serviceOf(ctx, name) {
  if (typeof ctx.get === 'function') {
    try {
      return ctx.get(name);
    } catch {
      return undefined;
    }
  }
  try {
    return ctx[name];
  } catch {
    return undefined;
  }
}

function defaultSelectionOf(ctx) {
  return serviceOf(ctx, 'agentDefaultModel')?.currentSelection?.() || null;
}

function agentOptionsOf(ctx) {
  const sel = defaultSelectionOf(ctx);
  if (!sel?.provider || !sel?.model) return undefined;
  return { provider: sel.provider, model: sel.model };
}

function installModelSelection(agentCtx, selection) {
  const disposeAssembly = agentCtx.on?.('system-prompt/assemble', async (_assembly, _context, next) => {
    const selected = selection.current;
    const assembled = await next();
    selection.assembled = selected;
    if (!selected) return assembled;
    return {
      ...assembled,
      variables: {
        ...assembled.variables,
        provider: selected.provider,
        model: selected.model,
      },
    };
  });
  const disposeRequest = agentCtx.on?.('agent/request', async (_payload, next) => {
    const resolved = await next();
    const selected = selection.assembled;
    if (!selected) return resolved;
    const { reasoningEffort: _inherited, ...rest } = resolved;
    return {
      ...rest,
      provider: selected.provider,
      model: selected.model,
      ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
    };
  });
  return () => {
    if (typeof disposeAssembly === 'function') disposeAssembly();
    if (typeof disposeRequest === 'function') disposeRequest();
  };
}

async function composeAgent(ctx) {
  const presets = serviceOf(ctx, 'agentPresets');
  let agentPreset;
  if (typeof presets?.resolve === 'function') {
    try {
      agentPreset = (await presets.resolve()).id;
    } catch {
      agentPreset = undefined;
    }
  }
  const selection = {
    get current() {
      return defaultSelectionOf(ctx) || undefined;
    },
    assembled: undefined,
  };
  return {
    agentPreset,
    agentOptions: agentOptionsOf(ctx),
    setup: async (agentCtx) => {
      installModelSelection(agentCtx, selection);
      if (typeof presets?.mount === 'function') await presets.mount(agentCtx, agentPreset);
    },
  };
}

function sessionMeta({ cwd, agentPreset }) {
  const meta = {
    ...(cwd ? { cwd } : {}),
    ...(agentPreset ? { agentPreset } : {}),
  };
  return Object.keys(meta).length ? meta : undefined;
}

export function createAgentBridge(ctx) {
  const agents = ctx.agents;
  if (!agents) {
    throw new Error('ctx.agents is required');
  }

  async function createSession({ cwd }) {
    const sessionId = mintSessionId();
    const composition = await composeAgent(ctx);
    const handle = await agents.create({
      sessionId,
      agentOptions: composition.agentOptions,
      meta: sessionMeta({ cwd, agentPreset: composition.agentPreset }),
      setup: composition.setup,
    });
    const agent = unwrapAgent(handle);
    return { sessionId: sessionIdOf(agent) || sessionId, agent };
  }

  async function resumeOrCreate({ sessionId, cwd }) {
    if (sessionId) {
      const live = unwrapAgent(agents.get?.(sessionId));
      const defaultOptions = agentOptionsOf(ctx);
      const liveHasModel = Boolean(live?.options?.model);
      if (live && (liveHasModel || !defaultOptions)) {
        return { sessionId: sessionIdOf(live) || sessionId, agent: live };
      }
      if (typeof agents.resume === 'function') {
        try {
          const composition = await composeAgent(ctx);
          const handle = await agents.resume({
            resumeSessionId: sessionId,
            agentOptions: composition.agentOptions,
            setup: composition.setup,
          });
          const agent = unwrapAgent(handle);
          if (agent) return { sessionId: sessionIdOf(agent) || sessionId, agent };
        } catch {
          /* create below */
        }
      }
    }
    return createSession({ cwd });
  }

  async function followup(agent, text) {
    const message = userMessage(text);
    if (typeof agent.followup === 'function') {
      return agent.followup(message);
    }
    if (typeof agent.prompt === 'function') {
      return agent.prompt(text);
    }
    throw new Error('agent has no followup/prompt');
  }

  async function waitIdle(agent) {
    if (typeof agent.whenIdle === 'function') return agent.whenIdle();
    if (typeof agent.waitUntilIdle === 'function') return agent.waitUntilIdle();
    if (typeof agent.idle === 'function') return agent.idle();
  }

  function listen(agent, { onTool }) {
    const pieces = [];
    const handler = (...args) => {
      const event = args.length >= 2 ? args[1] : args[0];
      const session = args.length >= 2 ? args[0] : null;
      if (session?.id && agent.id && session.id !== agent.id) return;
      const tool = toolNameOf(event);
      if (tool) onTool?.(tool);
      const text = collectText(event);
      if (text) pieces.push(text);
    };
    const target = ctx;
    const off = target.on?.('session/event', handler);
    return {
      text() {
        return pieces.join('');
      },
      stop() {
        if (typeof off === 'function') off();
        else target.off?.('session/event', handler);
      },
    };
  }

  async function runTurn({ cwd, sessionId, text, onSessionId, onTool }) {
    const { agent, sessionId: sid } = await resumeOrCreate({ sessionId, cwd });
    onSessionId?.(sid);
    const sub = listen(agent, { onTool });
    try {
      await followup(agent, text);
      await waitIdle(agent);
      return { sessionId: sessionIdOf(agent) || sid, text: sub.text(), agent };
    } finally {
      sub.stop();
    }
  }

  async function cancel(sessionId) {
    const agent = unwrapAgent(agents.get?.(sessionId));
    if (typeof agent?.cancel === 'function') return agent.cancel({ kind: 'user' });
    if (typeof agent?.abort === 'function') return agent.abort();
    if (typeof agents.cancel === 'function') return agents.cancel(sessionId);
  }

  return { createSession, runTurn, cancel };
}
