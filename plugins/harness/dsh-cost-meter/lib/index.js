import { applyEvent, initState, view } from './fold.js';

export const name = 'cost-meter';
export const inject = ['sessionProjections'];

function passthroughSchema() {
  return {
    parse(value) {
      return value;
    },
  };
}

export function buildDefinition() {
  const schema = passthroughSchema();
  return {
    key: 'costMeter',
    stateVersion: 1,
    stateSchema: schema,
    init: initState,
    apply: applyEvent,
    wire: {
      viewSchema: schema,
      view,
    },
  };
}

export function apply(ctx) {
  try {
    ctx.sessionProjections.register(buildDefinition());
  } catch (err) {
    console.warn('[dsh-cost-meter] failed to register costMeter projection', err);
  }
}
