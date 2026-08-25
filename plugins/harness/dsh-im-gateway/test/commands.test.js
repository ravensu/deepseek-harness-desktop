import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitText } from '../lib/split.js';
import { parseApprovalReply, parseCommand } from '../lib/commands.js';

test('splitText keeps short strings whole', () => {
  assert.deepEqual(splitText('hello'), ['hello']);
});

test('splitText prefers paragraph breaks under the limit', () => {
  const a = 'A'.repeat(100);
  const b = 'B'.repeat(100);
  const parts = splitText(`${a}\n\n${b}`, 120);
  assert.equal(parts.length, 2);
  assert.equal(parts[0], a);
  assert.equal(parts[1], b);
});

test('parseCommand reads name and arg', () => {
  assert.deepEqual(parseCommand('/cwd C:\\proj'), { name: 'cwd', arg: 'C:\\proj', raw: '/cwd C:\\proj' });
  assert.equal(parseCommand('hello'), null);
});

test('parseApprovalReply accepts 1/2 and slash commands', () => {
  assert.equal(parseApprovalReply('1'), 'approve');
  assert.equal(parseApprovalReply('/deny'), 'deny');
  assert.equal(parseApprovalReply('hello'), null);
});
