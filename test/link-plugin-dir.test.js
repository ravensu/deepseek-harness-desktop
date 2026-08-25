'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isLinkedTo, linkPluginDir, removePluginDest } = require('../src/main/link-plugin-dir');

test('linkPluginDir creates a live directory link', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-link-'));
  try {
    const source = path.join(root, 'src');
    const dest = path.join(root, 'dest');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'a.txt'), 'hello');
    const first = linkPluginDir(source, dest);
    assert.equal(first.changed, true);
    assert.equal(isLinkedTo(dest, source), true);
    assert.equal(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8'), 'hello');
    fs.writeFileSync(path.join(source, 'b.txt'), 'live');
    assert.equal(fs.readFileSync(path.join(dest, 'b.txt'), 'utf8'), 'live');
    const second = linkPluginDir(source, dest);
    assert.equal(second.changed, false);
  } finally {
    removePluginDest(path.join(root, 'dest'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('removePluginDest unlinks without deleting the source tree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-unlink-'));
  try {
    const source = path.join(root, 'src');
    const dest = path.join(root, 'dest');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'keep.txt'), 'ok');
    linkPluginDir(source, dest);
    removePluginDest(dest);
    assert.equal(fs.existsSync(dest), false);
    assert.equal(fs.readFileSync(path.join(source, 'keep.txt'), 'utf8'), 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
