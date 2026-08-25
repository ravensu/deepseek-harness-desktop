import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApprovals } from '../lib/approvals.js';
import { createProgress } from '../lib/progress.js';

test('approvals resolve 1/2 and time out to deny', async () => {
  const timers = [];
  const approvals = createApprovals({
    timeoutMs: 1000,
    setTimeoutFn: (fn) => {
      timers.push(fn);
      return 1;
    },
    clearTimeoutFn: () => {},
  });
  const p = approvals.wait('weixin:u', { toolName: 'bash', argsPreview: 'ls' });
  assert.equal(approvals.has('weixin:u'), true);
  assert.equal(approvals.decide('weixin:u', 'approve'), true);
  assert.equal(await p, 'approve');
  assert.equal(approvals.has('weixin:u'), false);

  const p2 = approvals.wait('weixin:u', { toolName: 'bash' });
  timers.pop()();
  assert.equal(await p2, 'deny');
});

test('progress announces first tool, throttles, then splits final text', async () => {
  const sent = [];
  let now = 0;
  const progress = createProgress({
    send: async (key, text) => sent.push([key, text]),
    gapMs: 15_000,
    clock: () => now,
    split: (t) => [t.slice(0, 4), t.slice(4)].filter(Boolean),
  });
  assert.equal(await progress.onTool('k', 'bash'), true);
  assert.equal(await progress.onTool('k', 'read'), false);
  now = 16_000;
  assert.equal(await progress.onTool('k', 'read'), true);
  await progress.onFinal('k', 'abcdefgh');
  assert.deepEqual(
    sent.map((x) => x[1]),
    ['开始处理：bash', '进行中：read', 'abcd', 'efgh'],
  );
});
