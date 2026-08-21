'use strict';

const fs = require('fs');
const path = require('path');
const {
  harnessRoot,
  harnessStagingRoot,
  harnessPrevRoot,
  harnessBrokenRoot,
  harnessSeedRoot,
  harnessLooksComplete,
  harnessRuntimeReady,
  harnessMissingParts,
  nodePathIn,
  writeVersionJson,
  readVersionJson,
  timestampStamp,
  bootstrapNodeBinary,
} = require('./paths');

function rmIfExists(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function renameReplace(from, to) {
  rmIfExists(to);
  fs.renameSync(from, to);
}

function copyNodeIntoStaging(staging, srcNode) {
  if (!srcNode || !fs.existsSync(srcNode)) {
    throw new Error(`缺少 bootstrap Node: ${srcNode || '(未找到)'}`);
  }
  fs.mkdirSync(path.join(staging, 'node'), { recursive: true });
  fs.copyFileSync(srcNode, nodePathIn(staging));
  if (process.platform !== 'win32') {
    fs.chmodSync(nodePathIn(staging), 0o755);
  }
}

/**
 * Prepare staging and copy a Node binary into it.
 * Prefer the current sidecar Node; fall back to packaged bootstrap-node.
 */
function prepareStagingFromCurrent() {
  const current = harnessRoot();
  const staging = harnessStagingRoot();
  rmIfExists(staging);
  const srcNode = fs.existsSync(nodePathIn(current))
    ? nodePathIn(current)
    : bootstrapNodeBinary();
  copyNodeIntoStaging(staging, srcNode);
  return staging;
}

/**
 * Atomic swap: current → prev, staging → current.
 * On failure the caller should invoke rollbackToPrev().
 */
function commitStaging(versionInfo) {
  const current = harnessRoot();
  const staging = harnessStagingRoot();
  const prev = harnessPrevRoot();

  // version.json is written below — do not require it yet.
  if (!harnessRuntimeReady(staging)) {
    const missing = harnessMissingParts(staging).filter((p) => p !== 'version.json');
    throw new Error(`staging harness 不完整（缺: ${missing.join(', ') || 'unknown'}）: ${staging}`);
  }

  writeVersionJson(staging, {
    ...versionInfo,
    installedAt: versionInfo.installedAt || new Date().toISOString(),
  });

  if (!harnessLooksComplete(staging)) {
    throw new Error(`写入 version.json 后 staging 仍不完整: ${staging}`);
  }

  rmIfExists(prev);
  if (fs.existsSync(current)) {
    fs.renameSync(current, prev);
  }
  fs.renameSync(staging, current);
  return { current, prev };
}

/**
 * Roll back to harness.prev after a failed update.
 * Moves the broken current tree aside for inspection.
 */
function rollbackToPrev() {
  const current = harnessRoot();
  const prev = harnessPrevRoot();
  if (!fs.existsSync(prev)) {
    throw new Error(`没有可回滚的上一版本: ${prev}`);
  }
  const broken = harnessBrokenRoot(timestampStamp());
  if (fs.existsSync(current)) {
    renameReplace(current, broken);
  }
  fs.renameSync(prev, current);
  return { current, broken };
}

/**
 * Replace writable harness with the local seed when available (dev/test).
 * Packaged builds have no seed — callers should reinstall the default npm version.
 */
async function restoreFromSeed() {
  const seed = harnessSeedRoot();
  if (!harnessLooksComplete(seed)) {
    throw new Error(`本地种子不可用: ${seed}`);
  }
  const current = harnessRoot();
  const prev = harnessPrevRoot();
  const staging = harnessStagingRoot();

  rmIfExists(staging);
  fs.mkdirSync(path.dirname(current), { recursive: true });
  await fs.promises.cp(seed, staging, { recursive: true, dereference: false });

  const seedVer = readVersionJson(seed) || {};
  writeVersionJson(staging, {
    dsh: seedVer.dsh || null,
    node: seedVer.node || null,
    installedAt: new Date().toISOString(),
    source: 'seed',
  });

  rmIfExists(prev);
  if (fs.existsSync(current)) {
    fs.renameSync(current, prev);
  }
  fs.renameSync(staging, current);
  return { current, prev, version: readVersionJson(current) };
}

/**
 * Remove leftover update artifacts after a successful install/restore.
 * Keeps the active harness/ tree; drops prev/staging/broken/installing.
 */
function cleanupHarnessArtifacts(options = {}) {
  const keepPrev = Boolean(options.keepPrev);
  const root = harnessRoot();
  const parent = path.dirname(root);
  const removed = [];

  const candidates = [
    !keepPrev && harnessPrevRoot(),
    harnessStagingRoot(),
    `${root}.installing`,
    path.join(root, 'node_modules.linked'),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(dir);
    }
  }

  if (fs.existsSync(parent)) {
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!/^harness\.(broken-|installing)/.test(entry.name)) continue;
      const full = path.join(parent, entry.name);
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(full);
    }
  }

  return { removed };
}

module.exports = {
  rmIfExists,
  prepareStagingFromCurrent,
  commitStaging,
  rollbackToPrev,
  restoreFromSeed,
  cleanupHarnessArtifacts,
};
