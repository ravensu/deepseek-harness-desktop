'use strict';

const { test, after } = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-bootstrap-test-'));
const bootstrapRoot = path.join(tmpRoot, 'bootstrap-node');
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';

process.env.DSH_DESKTOP_ROOT = path.join(tmpRoot, 'desktop');
process.env.DSH_HARNESS_SEED = path.join(tmpRoot, 'missing-seed');
process.env.DSH_BOOTSTRAP_NODE_ROOT = bootstrapRoot;
delete process.env.DSH_BOOTSTRAP_NODE;

fs.mkdirSync(bootstrapRoot, { recursive: true });
fs.copyFileSync(process.execPath, path.join(bootstrapRoot, nodeName));
if (process.platform !== 'win32') {
  fs.chmodSync(path.join(bootstrapRoot, nodeName), 0o755);
}

const { bootstrapNodeBinary, nodePathIn } = require('../src/main/paths');
const { prepareStagingFromCurrent } = require('../src/main/layout');

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('bootstrapNodeBinary finds packaged flat node.exe (not node/node.exe)', () => {
  const found = bootstrapNodeBinary();
  assert.equal(found, path.join(bootstrapRoot, nodeName));
  assert.equal(fs.existsSync(nodePathIn(bootstrapRoot)), false);
});

test('prepareStagingFromCurrent copies flat bootstrap Node into sidecar node/', () => {
  const staging = prepareStagingFromCurrent();
  assert.ok(fs.existsSync(nodePathIn(staging)));
});
