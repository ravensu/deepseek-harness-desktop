export const METRIC_IDS = [
  'counts',
  'llm',
  'toolCall',
  'ttft',
  'tps',
  'cacheHit',
  'tokens',
  'turnCost',
  'sessionCost',
];

export function defaultItems() {
  return METRIC_IDS.map((id) => ({ id, enabled: true }));
}

export function normalizeLayout(raw) {
  const seen = new Set();
  const items = [];
  const src = Array.isArray(raw?.items) ? raw.items : [];
  for (const row of src) {
    if (!row || typeof row.id !== 'string') continue;
    if (!METRIC_IDS.includes(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    items.push({ id: row.id, enabled: row.enabled !== false });
  }
  for (const id of METRIC_IDS) {
    if (!seen.has(id)) items.push({ id, enabled: true });
  }
  return items;
}

export function moveItem(items, from, to) {
  if (!Array.isArray(items)) return defaultItems();
  if (from === to) return items.slice();
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items.slice();
  const next = items.slice();
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

export function pickGroups(items, values) {
  const groups = [];
  for (const row of items) {
    if (!row.enabled) continue;
    const text = values[row.id];
    if (typeof text === 'string' && text.length > 0) groups.push(text);
  }
  return groups;
}
