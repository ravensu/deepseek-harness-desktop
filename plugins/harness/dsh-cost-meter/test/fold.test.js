import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, initState, view } from '../lib/fold.js';

function atBeijing(hour, minute = 0) {
  return new Date(Date.UTC(2026, 7, 21, hour - 8, minute, 0)).getTime();
}

function header(model, time = atBeijing(8, 0)) {
  return {
    type: 'request/header',
    time,
    data: { header: { config: { model, provider: 'deepseek' } } },
  };
}

function usageChunk({ turn, step, usage, time = atBeijing(8, 0) }) {
  return {
    type: 'assistant/chunk',
    time,
    data: { turn, step, chunk: { type: 'usage', usage } },
  };
}

function usageMessage({ turn, step, usage, time = atBeijing(8, 0) }) {
  return {
    type: 'assistant/message',
    time,
    data: { turn, step, usage },
  };
}

test('streaming usage chunks last-wins and message does not double-count', () => {
  let state = initState();
  state = applyEvent(state, header('deepseek-v4-flash'));
  state = applyEvent(
    state,
    usageChunk({
      turn: 1,
      step: 0,
      usage: { inputTokens: 1000, cacheReadTokens: 0, outputTokens: 10 },
    }),
  );
  state = applyEvent(
    state,
    usageChunk({
      turn: 1,
      step: 0,
      usage: { inputTokens: 1000, cacheReadTokens: 0, outputTokens: 50 },
    }),
  );
  state = applyEvent(
    state,
    usageMessage({
      turn: 1,
      step: 0,
      usage: { inputTokens: 1000, cacheReadTokens: 0, outputTokens: 50 },
    }),
  );
  const v = view(state);
  assert.equal(v.sessionTokens.outputTokens, 50);
  assert.equal(v.sessionTokens.inputTokens, 1000);
  // (1000*1.5 + 50*4.5) / 1e6 = 0.001725
  assert.equal(v.sessionCostCny, 0.001725);
  assert.equal(v.turnCostCny, 0.001725);
  assert.equal(v.sessionCosts.inputCost, 0.0015);
  assert.ok(Math.abs(v.sessionCosts.outputCost - 0.000225) < 1e-12);
});

test('new turn resets turn cost and keeps session total', () => {
  let state = initState();
  state = applyEvent(state, header('deepseek-v4-flash'));
  state = applyEvent(
    state,
    usageChunk({
      turn: 1,
      step: 0,
      usage: { inputTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 0 },
    }),
  );
  state = applyEvent(
    state,
    usageChunk({
      turn: 2,
      step: 0,
      usage: { inputTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 0 },
    }),
  );
  const v = view(state);
  assert.equal(v.turnCostCny, 1.5);
  assert.equal(v.sessionCostCny, 3);
  assert.equal(v.turnTokens.inputTokens, 1_000_000);
  assert.equal(v.sessionTokens.inputTokens, 2_000_000);
});

test('cache now is this turn; avg is session hit/(hit+miss)', () => {
  let state = initState();
  state = applyEvent(state, header('deepseek-v4-flash'));
  state = applyEvent(
    state,
    usageChunk({
      turn: 1,
      step: 0,
      usage: { inputTokens: 20, cacheReadTokens: 80, outputTokens: 0 },
    }),
  );
  let v = view(state);
  assert.equal(v.cacheNow, 0.8);
  assert.equal(v.cacheAvg, 0.8);

  state = applyEvent(
    state,
    usageChunk({
      turn: 2,
      step: 0,
      usage: { inputTokens: 50, cacheReadTokens: 0, outputTokens: 0 },
    }),
  );
  v = view(state);
  assert.equal(v.cacheNow, 0);
  assert.equal(v.cacheAvg, 80 / 150);
});

test('unknown model keeps tokens but priced is false', () => {
  let state = initState();
  state = applyEvent(state, header('mystery-model'));
  state = applyEvent(
    state,
    usageChunk({
      turn: 1,
      step: 0,
      usage: { inputTokens: 100, cacheReadTokens: 0, outputTokens: 10 },
    }),
  );
  const v = view(state);
  assert.equal(v.priced, false);
  assert.equal(v.sessionCostCny, 0);
  assert.equal(v.sessionTokens.inputTokens, 100);
  assert.equal(v.sessionTokens.outputTokens, 10);
});

test('peak sample uses peak rates even if later viewed off-peak', () => {
  let state = initState();
  state = applyEvent(state, header('deepseek-v4-flash', atBeijing(10, 0)));
  state = applyEvent(
    state,
    usageChunk({
      turn: 1,
      step: 0,
      time: atBeijing(10, 0),
      usage: { inputTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 0 },
    }),
  );
  const v = view(state);
  assert.equal(v.sessionCostCny, 3);
  assert.equal(v.tier, 'peak');
});
