import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultItems, METRIC_IDS, moveItem, normalizeLayout, pickGroups } from '../lib/layout.js';

test('normalizeLayout fills defaults and drops unknown ids', () => {
  const items = normalizeLayout({
    items: [
      { id: 'sessionCost', enabled: true },
      { id: 'nope', enabled: true },
      { id: 'counts', enabled: false },
    ],
  });
  assert.equal(items[0].id, 'sessionCost');
  assert.equal(items[1].id, 'counts');
  assert.equal(items[1].enabled, false);
  assert.deepEqual(
    items.map((r) => r.id),
    ['sessionCost', 'counts', ...METRIC_IDS.filter((id) => id !== 'sessionCost' && id !== 'counts')],
  );
  assert.equal(items.length, METRIC_IDS.length);
});

test('normalizeLayout uses all-on defaults for garbage input', () => {
  assert.deepEqual(normalizeLayout(null), defaultItems());
  assert.deepEqual(normalizeLayout({}), defaultItems());
});

test('moveItem reorders and ignores out-of-range indexes', () => {
  const start = defaultItems();
  const moved = moveItem(start, 0, 2);
  assert.equal(moved[2].id, 'counts');
  assert.equal(moved[0].id, 'llm');
  assert.deepEqual(
    moveItem(start, -1, 0).map((r) => r.id),
    METRIC_IDS,
  );
});

test('pickGroups follows enabled order and skips empty values', () => {
  const items = [
    { id: 'tokens', enabled: true },
    { id: 'counts', enabled: false },
    { id: 'turnCost', enabled: true },
    { id: 'sessionCost', enabled: true },
  ];
  assert.deepEqual(
    pickGroups(items, { tokens: '输入 1K', counts: '1 轮', turnCost: '', sessionCost: '会话 ¥0.1' }),
    ['输入 1K', '会话 ¥0.1'],
  );
});
