/** Official DeepSeek CNY rates per 1M tokens (effective 2026-08-17). */

export const PER_MILLION = 1_000_000;

const FLASH = {
  offpeak: { cacheRead: 0.05, input: 1.5, output: 4.5 },
  peak: { cacheRead: 0.1, input: 3.0, output: 9.0 },
};

const PRO = {
  offpeak: { cacheRead: 0.15, input: 4.5, output: 13.5 },
  peak: { cacheRead: 0.3, input: 9.0, output: 27.0 },
};

/**
 * @param {string | null | undefined} id
 * @returns {'flash' | 'pro' | null}
 */
export function resolveModel(id) {
  if (typeof id !== 'string' || id === '') return null;
  const key = id.toLowerCase();
  if (key.includes('v4-pro')) return 'pro';
  if (key.includes('v4-flash')) return 'flash';
  return null;
}

/**
 * Peak windows are Beijing [09:00, 12:00) and [14:00, 18:00).
 * @param {Date | number} at
 */
export function isPeakBeijing(at) {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const hm = hour * 60 + minute;
  return (hm >= 9 * 60 && hm < 12 * 60) || (hm >= 14 * 60 && hm < 18 * 60);
}

function tableFor(kind) {
  if (kind === 'flash') return FLASH;
  if (kind === 'pro') return PRO;
  return null;
}

/**
 * @param {object} usage
 * @param {string | null | undefined} model
 * @param {Date | number} at
 */
export function priceBuckets(usage, model, at) {
  const kind = resolveModel(model);
  const table = tableFor(kind);
  if (!table) {
    return { priced: false, tier: null, cost: 0, inputCost: 0, cacheReadCost: 0, outputCost: 0 };
  }
  const peak = isPeakBeijing(at);
  const tier = peak ? 'peak' : 'offpeak';
  const rates = table[tier];
  const inputTokens = Number(usage?.inputTokens) || 0;
  const cacheReadTokens = Number(usage?.cacheReadTokens) || 0;
  const cacheWriteTokens = Number(usage?.cacheWriteTokens) || 0;
  const outputTokens = Number(usage?.outputTokens) || 0;
  const inputCost = ((inputTokens + cacheWriteTokens) * rates.input) / PER_MILLION;
  const cacheReadCost = (cacheReadTokens * rates.cacheRead) / PER_MILLION;
  const outputCost = (outputTokens * rates.output) / PER_MILLION;
  return {
    priced: true,
    tier,
    cost: inputCost + cacheReadCost + outputCost,
    inputCost,
    cacheReadCost,
    outputCost,
  };
}
