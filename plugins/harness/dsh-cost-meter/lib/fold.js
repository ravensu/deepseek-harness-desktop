import { priceBuckets, resolveModel } from './pricing.js';

function emptyTokens() {
  return { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
}

function asTokens(usage) {
  return {
    inputTokens: Number(usage?.inputTokens) || 0,
    cacheReadTokens: Number(usage?.cacheReadTokens) || 0,
    cacheWriteTokens: Number(usage?.cacheWriteTokens) || 0,
    outputTokens: Number(usage?.outputTokens) || 0,
  };
}

function addTokens(left, right) {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  };
}

function subTokens(left, right) {
  return {
    inputTokens: left.inputTokens - right.inputTokens,
    cacheReadTokens: left.cacheReadTokens - right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens - right.cacheWriteTokens,
    outputTokens: left.outputTokens - right.outputTokens,
  };
}

function tokensEqual(left, right) {
  return (
    left.inputTokens === right.inputTokens &&
    left.cacheReadTokens === right.cacheReadTokens &&
    left.cacheWriteTokens === right.cacheWriteTokens &&
    left.outputTokens === right.outputTokens
  );
}

function hitRate(tokens) {
  const denom = tokens.cacheReadTokens + tokens.inputTokens;
  if (denom <= 0) return null;
  return tokens.cacheReadTokens / denom;
}

function usageOfEvent(event) {
  if (event.type === 'assistant/chunk' && event.data?.chunk?.type === 'usage') {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.chunk.usage };
  }
  if (event.type === 'assistant/message' && event.data?.usage !== undefined) {
    return { turn: event.data.turn, step: event.data.step, usage: event.data.usage };
  }
  return undefined;
}

function routeFromEvent(event) {
  if (event.type === 'request/context') {
    return { provider: event.data?.provider, model: event.data?.model };
  }
  if (event.type === 'request/header') {
    const config = event.data?.header?.config;
    return { provider: config?.provider, model: config?.model };
  }
  return undefined;
}

function emptyCosts() {
  return { inputCost: 0, cacheReadCost: 0, outputCost: 0 };
}

export function initState() {
  return {
    model: null,
    provider: null,
    sessionCostCny: 0,
    turnCostCny: 0,
    sessionCosts: emptyCosts(),
    turnCosts: emptyCosts(),
    sessionTokens: emptyTokens(),
    turnTokens: emptyTokens(),
    turn: null,
    last: null,
    lastTier: null,
  };
}

export function applyEvent(state, event) {
  let next = state;
  const route = routeFromEvent(event);
  if (route) {
    const provider = route.provider !== undefined ? route.provider : next.provider;
    const model = route.model !== undefined ? route.model : next.model;
    if (provider !== next.provider || model !== next.model) {
      next = { ...next, provider, model };
    }
  }

  const sample = usageOfEvent(event);
  if (sample === undefined) return next;

  const buckets = asTokens(sample.usage);
  const sameStep = next.last !== null && next.last.turn === sample.turn && next.last.step === sample.step;
  const previous = sameStep ? next.last.buckets : null;
  if (previous !== null && tokensEqual(previous, buckets)) return next;

  const delta = previous === null ? buckets : subTokens(buckets, previous);
  let turnTokens = next.turnTokens;
  let turnCostCny = next.turnCostCny;
  let turnCosts = next.turnCosts;
  if (next.turn !== sample.turn) {
    turnTokens = emptyTokens();
    turnCostCny = 0;
    turnCosts = emptyCosts();
  }

  const priced = priceBuckets(delta, next.model, event.time ?? Date.now());
  const deltaCosts = {
    inputCost: priced.inputCost,
    cacheReadCost: priced.cacheReadCost,
    outputCost: priced.outputCost,
  };
  return {
    ...next,
    turn: sample.turn,
    sessionTokens: addTokens(next.sessionTokens, delta),
    turnTokens: addTokens(turnTokens, delta),
    sessionCostCny: next.sessionCostCny + priced.cost,
    turnCostCny: turnCostCny + priced.cost,
    sessionCosts: {
      inputCost: next.sessionCosts.inputCost + deltaCosts.inputCost,
      cacheReadCost: next.sessionCosts.cacheReadCost + deltaCosts.cacheReadCost,
      outputCost: next.sessionCosts.outputCost + deltaCosts.outputCost,
    },
    turnCosts: {
      inputCost: turnCosts.inputCost + deltaCosts.inputCost,
      cacheReadCost: turnCosts.cacheReadCost + deltaCosts.cacheReadCost,
      outputCost: turnCosts.outputCost + deltaCosts.outputCost,
    },
    lastTier: priced.tier ?? next.lastTier,
    last: { turn: sample.turn, step: sample.step, buckets },
  };
}

export function view(state) {
  return {
    turnCostCny: state.turnCostCny,
    sessionCostCny: state.sessionCostCny,
    turnTokens: state.turnTokens,
    sessionTokens: state.sessionTokens,
    turnCosts: state.turnCosts,
    sessionCosts: state.sessionCosts,
    cacheNow: hitRate(state.turnTokens),
    cacheAvg: hitRate(state.sessionTokens),
    model: state.model,
    tier: state.lastTier,
    priced: resolveModel(state.model) != null,
  };
}
