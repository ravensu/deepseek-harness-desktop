'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseReadyUrl } = require('../src/main/parse');

test('parseReadyUrl extracts loopback url', () => {
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:43121'), 'http://127.0.0.1:43121');
  assert.equal(parseReadyUrl('noise'), null);
});
