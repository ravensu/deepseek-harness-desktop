'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseReadyUrl } = require('../src/main/parse');

test('parseReadyUrl extracts loopback url', () => {
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:43121'), 'http://127.0.0.1:43121');
  assert.equal(parseReadyUrl('noise'), null);
});

test('parseReadyUrl keeps auth token query (dsh >= 0.1.2)', () => {
  const line = 'dsh web: http://127.0.0.1:4548/?token=2_jB9udxndj4NRWLz5iCzUzidm9EK7SMaliFi4TabJo';
  assert.equal(
    parseReadyUrl(line),
    'http://127.0.0.1:4548/?token=2_jB9udxndj4NRWLz5iCzUzidm9EK7SMaliFi4TabJo',
  );
});

test('parseReadyUrl does not swallow trailing log text', () => {
  const line = 'dsh web: http://127.0.0.1:4548/?token=abc123 (press ctrl+c to quit)';
  assert.equal(parseReadyUrl(line), 'http://127.0.0.1:4548/?token=abc123');
});

test('parseReadyUrl ignores non-loopback hosts', () => {
  assert.equal(parseReadyUrl('dsh web: http://0.0.0.0:4548/?token=abc'), null);
  assert.equal(parseReadyUrl('server: http://127.0.0.1:4548'), null);
});
