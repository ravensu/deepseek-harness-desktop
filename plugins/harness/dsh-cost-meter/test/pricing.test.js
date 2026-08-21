import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPeakBeijing, priceBuckets, resolveModel } from '../lib/pricing.js';

/** 2026-08-21 is CST (UTC+8), no DST. hour/minute are Beijing wall-clock. */
function atBeijing(hour, minute = 0) {
  return new Date(Date.UTC(2026, 7, 21, hour - 8, minute, 0));
}

test('peak: 09:00, 11:59, 14:00, 17:59 Beijing', () => {
  assert.equal(isPeakBeijing(atBeijing(9, 0)), true);
  assert.equal(isPeakBeijing(atBeijing(11, 59)), true);
  assert.equal(isPeakBeijing(atBeijing(14, 0)), true);
  assert.equal(isPeakBeijing(atBeijing(17, 59)), true);
});

test('off-peak: 08:59, 12:00, 13:59, 18:00 Beijing', () => {
  assert.equal(isPeakBeijing(atBeijing(8, 59)), false);
  assert.equal(isPeakBeijing(atBeijing(12, 0)), false);
  assert.equal(isPeakBeijing(atBeijing(13, 59)), false);
  assert.equal(isPeakBeijing(atBeijing(18, 0)), false);
});

test('resolveModel maps official v4 ids', () => {
  assert.equal(resolveModel('deepseek-v4-flash'), 'flash');
  assert.equal(resolveModel('deepseek-v4-flash-vision-exp'), 'flash');
  assert.equal(resolveModel('deepseek-v4-pro'), 'pro');
  assert.equal(resolveModel('some-other-model'), null);
  assert.equal(resolveModel(null), null);
});

test('flash off-peak matches hand calc', () => {
  const priced = priceBuckets(
    { inputTokens: 1000, cacheReadTokens: 2000, outputTokens: 500, cacheWriteTokens: 0 },
    'deepseek-v4-flash',
    atBeijing(8, 0),
  );
  // (1000*1.5 + 2000*0.05 + 500*4.5) / 1e6 = 0.00385
  assert.equal(priced.priced, true);
  assert.equal(priced.tier, 'offpeak');
  assert.equal(priced.cost, 0.00385);
});

test('same flash sample at peak is double off-peak', () => {
  const buckets = { inputTokens: 1000, cacheReadTokens: 2000, outputTokens: 500, cacheWriteTokens: 0 };
  const off = priceBuckets(buckets, 'deepseek-v4-flash', atBeijing(8, 0));
  const peak = priceBuckets(buckets, 'deepseek-v4-flash', atBeijing(10, 0));
  assert.equal(peak.tier, 'peak');
  assert.equal(peak.cost, off.cost * 2);
});

test('unknown model is not priced', () => {
  const priced = priceBuckets(
    { inputTokens: 100, cacheReadTokens: 0, outputTokens: 10, cacheWriteTokens: 0 },
    'gpt-x',
    atBeijing(10, 0),
  );
  assert.equal(priced.priced, false);
  assert.equal(priced.cost, 0);
  assert.equal(priced.tier, null);
});

test('missing bucket fields count as zero', () => {
  const priced = priceBuckets({}, 'deepseek-v4-pro', atBeijing(8, 0));
  assert.equal(priced.priced, true);
  assert.equal(priced.cost, 0);
});

test('cache write is billed at miss rate', () => {
  const priced = priceBuckets(
    { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000 },
    'deepseek-v4-flash',
    atBeijing(8, 0),
  );
  assert.equal(priced.cost, 1.5);
});
