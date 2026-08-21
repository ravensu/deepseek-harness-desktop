'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function resourcesRoot() {
  try {
    const { app } = require('electron');
    if (app?.isPackaged) return process.resourcesPath;
  } catch {
    // tests / scripts without electron
  }
  return path.join(__dirname, '..', '..');
}

function isPackaged() {
  try {
    const { app } = require('electron');
    return Boolean(app?.isPackaged);
  } catch {
    return false;
  }
}

/**
 * Writable root for the harness sidecar (not Electron userData).
 * Windows: %LOCALAPPDATA%\dsh-desktop
 * macOS: ~/Library/Application Support/dsh-desktop
 * Linux: ~/.local/share/dsh-desktop
 */
function writableDesktopRoot() {
  if (process.env.DSH_DESKTOP_ROOT && process.env.DSH_DESKTOP_ROOT.trim()) {
    return path.resolve(process.env.DSH_DESKTOP_ROOT.trim());
  }
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'dsh-desktop');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'dsh-desktop');
  }
  const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdg, 'dsh-desktop');
}

function harnessRoot() {
  if (process.env.DSH_HARNESS_ROOT && process.env.DSH_HARNESS_ROOT.trim()) {
    return path.resolve(process.env.DSH_HARNESS_ROOT.trim());
  }
  return path.join(writableDesktopRoot(), 'harness');
}

function harnessSibling(suffix) {
  return `${harnessRoot()}${suffix}`;
}

function harnessStagingRoot() {
  return harnessSibling('.staging');
}

function harnessPrevRoot() {
  return harnessSibling('.prev');
}

function harnessBrokenRoot(stamp = timestampStamp()) {
  return harnessSibling(`.broken-${stamp}`);
}

function timestampStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Read-only seed shipped inside the installer (or staged for dev). */
function harnessSeedRoot() {
  if (process.env.DSH_HARNESS_SEED && process.env.DSH_HARNESS_SEED.trim()) {
    return path.resolve(process.env.DSH_HARNESS_SEED.trim());
  }
  if (isPackaged()) {
    return path.join(resourcesRoot(), 'harness-seed');
  }
  return path.join(resourcesRoot(), 'sidecar', 'harness');
}

/** Tiny Node tree shipped with the shell for first-run npm install. */
function bootstrapNodeRoot() {
  if (process.env.DSH_BOOTSTRAP_NODE_ROOT && process.env.DSH_BOOTSTRAP_NODE_ROOT.trim()) {
    return path.resolve(process.env.DSH_BOOTSTRAP_NODE_ROOT.trim());
  }
  if (isPackaged()) {
    return path.join(resourcesRoot(), 'bootstrap-node');
  }
  return path.join(resourcesRoot(), 'sidecar', 'bootstrap-node');
}

function bootstrapNodeBinary() {
  if (process.env.DSH_BOOTSTRAP_NODE && fs.existsSync(process.env.DSH_BOOTSTRAP_NODE)) {
    return process.env.DSH_BOOTSTRAP_NODE;
  }
  const bundled = nodePathIn(bootstrapNodeRoot());
  if (fs.existsSync(bundled)) return bundled;
  const current = nodePathIn(harnessRoot());
  if (fs.existsSync(current)) return current;
  const seed = nodePathIn(harnessSeedRoot());
  if (fs.existsSync(seed)) return seed;
  return null;
}

function hasUsableSeed() {
  return harnessLooksComplete(harnessSeedRoot());
}

function nodeBinaryName() {
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function nodePathIn(root) {
  return path.join(root, 'node', nodeBinaryName());
}

function versionPathIn(root) {
  return path.join(root, 'version.json');
}

function readVersionJson(root) {
  const file = versionPathIn(root);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeVersionJson(root, info) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(versionPathIn(root), `${JSON.stringify(info, null, 2)}\n`, 'utf8');
}

function harnessLooksComplete(root) {
  if (!harnessRuntimeReady(root)) return false;
  const ver = readVersionJson(root);
  return Boolean(ver && ver.dsh);
}

/** Runnable tree without requiring version.json (used right after pnpm install). */
function harnessRuntimeReady(root) {
  if (!root || !fs.existsSync(root)) return false;
  if (!fs.existsSync(nodePathIn(root))) return false;
  if (!fs.existsSync(path.join(root, 'package.json'))) return false;
  const group = path.join(root, 'node_modules', '@deepseek-ai', 'cordis-plugin-group', 'package.json');
  if (!fs.existsSync(group)) return false;
  try {
    resolveDshEntryIn(root);
    return true;
  } catch {
    return false;
  }
}

function harnessMissingParts(root) {
  const missing = [];
  if (!root || !fs.existsSync(root)) return ['root'];
  if (!fs.existsSync(nodePathIn(root))) missing.push('node');
  if (!fs.existsSync(path.join(root, 'package.json'))) missing.push('package.json');
  if (!fs.existsSync(path.join(root, 'node_modules', '@deepseek-ai', 'cordis-plugin-group', 'package.json'))) {
    missing.push('cordis-plugin-group');
  }
  try {
    resolveDshEntryIn(root);
  } catch {
    missing.push('dsh-entry');
  }
  const ver = readVersionJson(root);
  if (!ver || !ver.dsh) missing.push('version.json');
  return missing;
}

function resolveDshEntryIn(root) {
  const packageJson = require.resolve('@deepseek-ai/dsh/package.json', {
    paths: [root],
  });
  const manifest = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  const relative = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.dsh;
  return path.join(path.dirname(packageJson), relative);
}

function finalizeSeedCopy(root, seed) {
  const seedVer = readVersionJson(seed) || {};
  writeVersionJson(root, {
    dsh: seedVer.dsh || null,
    node: seedVer.node || process.version.replace(/^v/, ''),
    installedAt: new Date().toISOString(),
    source: 'seed',
  });
  return { root, created: true };
}

function prepareSeedCopyTarget(root) {
  fs.mkdirSync(path.dirname(root), { recursive: true });
  // Copy into a sibling first so a killed mid-copy never leaves a "half harness"
  // that looks runnable (dsh entry present) but cannot boot.
  return `${root}.installing`;
}

function commitSeedCopy(installing, root) {
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  fs.renameSync(installing, root);
}

/**
 * If writable harness is missing/incomplete, copy from seed once (dev/test).
 * Packaged shell has no full seed — use ensureHarnessReadyAsync (npm bootstrap).
 */
function ensureHarnessInstalled() {
  const root = harnessRoot();
  if (harnessLooksComplete(root)) {
    return { root, created: false };
  }
  const seed = harnessSeedRoot();
  if (!harnessLooksComplete(seed)) {
    throw new Error(
      `Harness 未就绪：${root}。打包版请走首次启动 npm 安装；开发态请先 pnpm run stage:harness。`,
    );
  }
  const installing = prepareSeedCopyTarget(root);
  if (fs.existsSync(installing)) {
    fs.rmSync(installing, { recursive: true, force: true });
  }
  fs.cpSync(seed, installing, { recursive: true, dereference: true });
  finalizeSeedCopy(installing, seed);
  commitSeedCopy(installing, root);
  return { root, created: true };
}

async function ensureHarnessInstalledAsync(onProgress) {
  const root = harnessRoot();
  if (harnessLooksComplete(root)) {
    return { root, created: false };
  }
  const seed = harnessSeedRoot();
  if (!harnessLooksComplete(seed)) {
    throw new Error(
      `Harness 未就绪：${root}。打包版请走首次启动 npm 安装；开发态请先 pnpm run stage:harness。`,
    );
  }
  if (typeof onProgress === 'function') {
    onProgress({ message: '正在从本地种子复制 Harness 运行时…' });
  }
  const installing = prepareSeedCopyTarget(root);
  if (fs.existsSync(installing)) {
    await fs.promises.rm(installing, { recursive: true, force: true });
  }
  await fs.promises.cp(seed, installing, { recursive: true, dereference: false });
  finalizeSeedCopy(installing, seed);
  commitSeedCopy(installing, root);
  if (typeof onProgress === 'function') {
    onProgress({ message: '运行时复制完成，正在启动…' });
  }
  return { root, created: true };
}

function resolveNode() {
  if (process.env.DSH_NODE && fs.existsSync(process.env.DSH_NODE)) {
    return process.env.DSH_NODE;
  }
  const root = harnessRoot();
  if (!harnessLooksComplete(root)) {
    throw new Error(`Harness 未安装: ${root}。请先调用 ensureHarnessInstalledAsync。`);
  }
  const bundled = nodePathIn(root);
  if (fs.existsSync(bundled)) return bundled;
  throw new Error(`未找到 sidecar Node: ${bundled}`);
}

function resolveDshEntry() {
  const root = harnessRoot();
  if (!harnessLooksComplete(root)) {
    throw new Error(`Harness 未安装: ${root}。请先调用 ensureHarnessInstalledAsync。`);
  }
  return resolveDshEntryIn(root);
}

function dshHome() {
  try {
    const { app } = require('electron');
    return process.env.DSH_HOME || path.join(app.getPath('userData'), 'dsh-home');
  } catch {
    return process.env.DSH_HOME || path.join(os.tmpdir(), 'dsh-desktop-home');
  }
}

function workspaceDir(home) {
  const dir = path.join(home, 'workspace');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function withLocalBins(env, harnessDir, nodeBinary) {
  const bin = path.join(harnessDir, 'node_modules', '.bin');
  const nodeDir = path.dirname(nodeBinary);
  const merged = { ...env };
  const value = `${nodeDir}${path.delimiter}${bin}${path.delimiter}${env.PATH || env.Path || ''}`;
  merged.PATH = value;
  merged.Path = value;
  return merged;
}

function shellPackageJson() {
  return path.join(__dirname, '..', '..', 'package.json');
}

function readShellManifest() {
  return JSON.parse(fs.readFileSync(shellPackageJson(), 'utf8'));
}

function seedDshVersion() {
  const manifest = readShellManifest();
  return manifest.dshDesktop?.seedDsh || null;
}

module.exports = {
  resourcesRoot,
  isPackaged,
  writableDesktopRoot,
  harnessRoot,
  harnessStagingRoot,
  harnessPrevRoot,
  harnessBrokenRoot,
  harnessSeedRoot,
  bootstrapNodeRoot,
  bootstrapNodeBinary,
  hasUsableSeed,
  nodeBinaryName,
  nodePathIn,
  versionPathIn,
  readVersionJson,
  writeVersionJson,
  harnessLooksComplete,
  harnessRuntimeReady,
  harnessMissingParts,
  resolveDshEntryIn,
  ensureHarnessInstalled,
  ensureHarnessInstalledAsync,
  resolveNode,
  resolveDshEntry,
  dshHome,
  workspaceDir,
  withLocalBins,
  readShellManifest,
  seedDshVersion,
  timestampStamp,
};
