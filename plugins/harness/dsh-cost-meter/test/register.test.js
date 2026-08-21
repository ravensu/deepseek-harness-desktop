import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDefinition } from '../lib/index.js';

test('costMeter registers with stateSchema + wire so the web client can read it', () => {
  const def = buildDefinition();
  assert.equal(def.key, 'costMeter');
  assert.equal(typeof def.stateSchema.parse, 'function');
  assert.equal(typeof def.wire.viewSchema.parse, 'function');
  assert.equal(typeof def.wire.view, 'function');
  const state = def.init();
  const projected = def.wire.view(state);
  assert.equal(projected.sessionCostCny, 0);
  assert.equal(def.wire.viewSchema.parse(projected), projected);
  assert.equal(def.stateSchema.parse(state), state);
});
