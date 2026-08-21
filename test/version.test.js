'use strict';

const { test } = require('node:test');
const assert = require('assert/strict');
const { compareSemver, listUpdateTargets } = require('../src/main/version');

test('compareSemver orders release candidates', () => {
  assert.ok(compareSemver('0.1.0-rc.7', '0.1.0-rc.8') < 0);
  assert.ok(compareSemver('0.1.0-rc.8', '0.1.0-rc.7') > 0);
  assert.equal(compareSemver('0.1.0-rc.7', '0.1.0-rc.7'), 0);
  assert.ok(compareSemver('0.1.0', '0.1.0-rc.8') > 0);
  assert.ok(compareSemver('0.2.0-rc.1', '0.1.0-rc.9') > 0);
});

test('listUpdateTargets marks latest and next relative to current', () => {
  const targets = listUpdateTargets('0.1.0-rc.7', {
    latest: '0.1.0-rc.7',
    next: '0.1.0-rc.8',
  });
  assert.equal(targets.length, 2);
  const latest = targets.find((t) => t.tag === 'latest');
  const next = targets.find((t) => t.tag === 'next');
  assert.ok(latest.same);
  assert.ok(next.newer);
  assert.equal(next.version, '0.1.0-rc.8');
});

test('listUpdateTargets dedupes identical tag versions', () => {
  const targets = listUpdateTargets('0.1.0-rc.7', {
    latest: '0.1.0-rc.7',
    next: '0.1.0-rc.7',
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].tag, 'latest');
});
