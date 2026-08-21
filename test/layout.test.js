'use strict';

const { test, before, after } = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-desktop-test-'));
process.env.DSH_DESKTOP_ROOT = path.join(tmpRoot, 'desktop');
process.env.DSH_HARNESS_SEED = path.join(tmpRoot, 'seed');

const {
  harnessRoot,
  harnessSeedRoot,
  harnessLooksComplete,
  ensureHarnessInstalled,
  writeVersionJson,
  readVersionJson,
  nodePathIn,
} = require('../src/main/paths');
const {
  prepareStagingFromCurrent,
  commitStaging,
  rollbackToPrev,
  restoreFromSeed,
} = require('../src/main/layout');

function fakeHarness(root, dshVersion = '0.1.0-rc.7') {
  fs.mkdirSync(path.join(root, 'node'), { recursive: true });
  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  fs.copyFileSync(process.execPath, path.join(root, 'node', nodeName));
  if (process.platform !== 'win32') {
    fs.chmodSync(path.join(root, 'node', nodeName), 0o755);
  }
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'dsh-harness-sidecar', private: true, version: '0.0.0' }),
  );
  const pkgDir = path.join(root, 'node_modules', '@deepseek-ai', 'dsh');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh', version: dshVersion, bin: { dsh: 'lib/bin.js' } }),
  );
  fs.mkdirSync(path.join(pkgDir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'lib', 'bin.js'), '#!/usr/bin/env node\nconsole.log("dsh")\n');
  const groupDir = path.join(root, 'node_modules', '@deepseek-ai', 'cordis-plugin-group');
  fs.mkdirSync(groupDir, { recursive: true });
  fs.writeFileSync(
    path.join(groupDir, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/cordis-plugin-group', version: '1.0.0' }),
  );
  writeVersionJson(root, {
    dsh: dshVersion,
    node: process.version.replace(/^v/, ''),
    installedAt: new Date().toISOString(),
    source: 'seed',
  });
}

before(() => {
  fakeHarness(harnessSeedRoot(), '0.1.0-rc.7');
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('ensureHarnessInstalled copies seed when writable harness missing', () => {
  const root = harnessRoot();
  if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  const result = ensureHarnessInstalled();
  assert.equal(result.created, true);
  assert.ok(harnessLooksComplete(root));
  assert.equal(readVersionJson(root).dsh, '0.1.0-rc.7');
  assert.equal(readVersionJson(root).source, 'seed');
});

test('ensureHarnessInstalled does not overwrite existing harness', () => {
  const root = harnessRoot();
  writeVersionJson(root, {
    dsh: '0.1.0-rc.8',
    node: '24.0.0',
    installedAt: '2026-01-01T00:00:00.000Z',
    source: 'npm',
  });
  const result = ensureHarnessInstalled();
  assert.equal(result.created, false);
  assert.equal(readVersionJson(root).dsh, '0.1.0-rc.8');
  assert.equal(readVersionJson(root).source, 'npm');
});

test('commitStaging swaps and rollbackToPrev restores', () => {
  const root = harnessRoot();
  if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  ensureHarnessInstalled();
  assert.equal(readVersionJson(root).dsh, '0.1.0-rc.7');

  const staging = prepareStagingFromCurrent();
  fakeHarness(staging, '0.1.0-rc.8');
  assert.ok(fs.existsSync(nodePathIn(staging)));

  commitStaging({
    dsh: '0.1.0-rc.8',
    node: '24.0.0',
    source: 'npm',
  });
  assert.equal(readVersionJson(root).dsh, '0.1.0-rc.8');

  fs.writeFileSync(path.join(root, 'broken-marker'), 'x');
  const { broken } = rollbackToPrev();
  assert.ok(fs.existsSync(broken));
  assert.equal(readVersionJson(root).dsh, '0.1.0-rc.7');
});

test('cleanupHarnessArtifacts removes prev and staging leftovers', () => {
  const root = harnessRoot();
  ensureHarnessInstalled();
  const prev = `${root}.prev`;
  const staging = `${root}.staging`;
  const broken = `${root}.broken-test`;
  fs.mkdirSync(prev, { recursive: true });
  fs.writeFileSync(path.join(prev, 'marker'), 'x');
  fs.mkdirSync(staging, { recursive: true });
  fs.writeFileSync(path.join(staging, 'marker'), 'x');
  fs.mkdirSync(broken, { recursive: true });
  fs.writeFileSync(path.join(broken, 'marker'), 'x');

  const { cleanupHarnessArtifacts } = require('../src/main/layout');
  const result = cleanupHarnessArtifacts();
  assert.ok(result.removed.some((p) => p.endsWith('harness.prev')));
  assert.ok(result.removed.some((p) => p.endsWith('harness.staging')));
  assert.ok(result.removed.some((p) => p.includes('harness.broken-')));
  assert.equal(fs.existsSync(prev), false);
  assert.equal(fs.existsSync(staging), false);
  assert.equal(fs.existsSync(broken), false);
  assert.ok(harnessLooksComplete(root));
});

test('harnessRuntimeReady does not require version.json', () => {
  const root = path.join(tmpRoot, 'runtime-only');
  fakeHarness(root, '0.1.0-rc.8');
  fs.rmSync(path.join(root, 'version.json'));
  const { harnessRuntimeReady } = require('../src/main/paths');
  assert.equal(harnessRuntimeReady(root), true);
  assert.equal(harnessLooksComplete(root), false);
});

test('restoreFromSeed replaces writable harness from seed', async () => {
  const root = harnessRoot();
  writeVersionJson(root, {
    dsh: '9.9.9',
    node: '1.0.0',
    installedAt: new Date().toISOString(),
    source: 'npm',
  });
  const result = await restoreFromSeed();
  assert.equal(result.version.dsh, '0.1.0-rc.7');
  assert.equal(result.version.source, 'seed');
  assert.ok(harnessLooksComplete(root));
});
