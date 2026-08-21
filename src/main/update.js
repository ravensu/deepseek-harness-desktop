'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const { listUpdateTargets } = require('./version');
const {
  harnessRoot,
  harnessStagingRoot,
  harnessPrevRoot,
  nodePathIn,
  readVersionJson,
  ensureHarnessInstalledAsync,
  seedDshVersion,
  harnessLooksComplete,
  harnessRuntimeReady,
  harnessMissingParts,
  resolveDshEntryIn,
  hasUsableSeed,
} = require('./paths');
const {
  prepareStagingFromCurrent,
  commitStaging,
  rollbackToPrev,
  restoreFromSeed,
  rmIfExists,
} = require('./layout');

let updateInFlight = false;

function isUpdateInFlight() {
  return updateInFlight;
}

function setUpdateInFlight(value) {
  updateInFlight = Boolean(value);
}

function npmRegistry() {
  return (process.env.DSH_NPM_REGISTRY || 'https://registry.npmjs.org').replace(/\/$/, '');
}

function noop() {}

async function fetchDistTags(packageName = '@deepseek-ai/dsh') {
  const registry = npmRegistry();
  const scoped = packageName.startsWith('@')
    ? `${registry}/${packageName.replace('/', '%2F')}`
    : `${registry}/${packageName}`;

  const response = await fetch(scoped, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`无法读取 npm dist-tags: ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  return body['dist-tags'] || {};
}

async function checkHarnessUpdates() {
  const current = readVersionJson(harnessRoot()) || {};
  const currentVersion = current.dsh || null;
  const distTags = await fetchDistTags('@deepseek-ai/dsh');
  const targets = listUpdateTargets(currentVersion, distTags);
  return {
    currentVersion,
    currentSource: current.source || null,
    registry: npmRegistry(),
    distTags,
    targets,
    seedVersion: seedDshVersion(),
  };
}

const ALLOW_BUILDS = {
  '@deepseek-ai/dsh-subprocess-local': true,
  '@google/genai': true,
  koffi: true,
  'node-pty': true,
  protobufjs: true,
};

function writeStagingManifest(staging, dshVersion) {
  const pkg = {
    name: 'dsh-harness-sidecar',
    private: true,
    version: '0.0.0',
    dependencies: {
      '@deepseek-ai/dsh': dshVersion,
      pnpm: '^11.22.0',
    },
  };
  fs.writeFileSync(path.join(staging, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  fs.writeFileSync(
    path.join(staging, 'pnpm-workspace.yaml'),
    [
      'nodeLinker: hoisted',
      'allowBuilds:',
      ...Object.keys(ALLOW_BUILDS).map((k) => `  ${JSON.stringify(k)}: true`),
      '',
    ].join('\n'),
  );
  fs.writeFileSync(path.join(staging, '.npmrc'), 'shamefully-hoist=true\n');
}

function spawnLogged(command, args, options, onLog) {
  const log = typeof onLog === 'function' ? onLog : noop;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const attach = (stream, input) => {
      readline.createInterface({ input }).on('line', (line) => {
        log({ stream, line: String(line) });
      });
    };
    attach('stdout', child.stdout);
    attach('stderr', child.stderr);

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function runPnpmInstall(staging, nodeBinary, onLog = noop) {
  const { bootstrapNodeRoot } = require('./paths');
  const pathWithNode = `${path.dirname(nodeBinary)}${path.delimiter}${process.env.PATH || process.env.Path || ''}`;
  const env = {
    ...process.env,
    npm_config_registry: npmRegistry(),
    npm_node_execpath: nodeBinary,
    NODE: nodeBinary,
    PATH: pathWithNode,
    Path: pathWithNode,
  };

  const bundledPnpm = path.join(bootstrapNodeRoot(), 'pnpm', 'bin', 'pnpm.cjs');
  const attempts = [];
  if (fs.existsSync(bundledPnpm)) {
    attempts.push({
      label: 'bundled pnpm install',
      command: nodeBinary,
      args: [bundledPnpm, 'install'],
      shell: false,
    });
  }
  attempts.push(
    {
      label: 'pnpm install',
      command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      args: ['install'],
      shell: true,
    },
    {
      label: 'npm exec pnpm install',
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['exec', '--yes', 'pnpm@11.22.0', '--', 'install'],
      shell: true,
    },
  );

  let last = null;
  for (const attempt of attempts) {
    onLog({ stream: 'system', line: `> ${attempt.label}` });
    last = await spawnLogged(attempt.command, attempt.args, { cwd: staging, env, shell: attempt.shell }, onLog);
    if (last.code === 0) {
      onLog({ stream: 'system', line: `${attempt.label} 完成` });
      return;
    }
    onLog({
      stream: 'system',
      line: `${attempt.label} 失败 (code=${last.code})，尝试备选方案…`,
    });
  }
  throw new Error(`pnpm install 失败，退出码 ${last?.code}`);
}

/**
 * Optional: turn pnpm's linked tree into a real directory tree.
 * Not needed for the writable sidecar at runtime (junctions/hardlinks work).
 * Kept for packaging scripts that need a portable tree.
 */
async function materializeNodeModules(root, onLog = noop) {
  const nm = path.join(root, 'node_modules');
  if (!fs.existsSync(nm)) throw new Error(`缺少 ${nm}`);
  const linked = path.join(root, 'node_modules.linked');
  rmIfExists(linked);
  fs.renameSync(nm, linked);
  fs.mkdirSync(nm, { recursive: true });
  onLog({ stream: 'system', line: '正在解引用 node_modules（较慢）…' });
  await fs.promises.cp(linked, nm, { recursive: true, dereference: true });
  rmIfExists(linked);
  const pnpmStore = path.join(nm, '.pnpm');
  if (fs.existsSync(pnpmStore)) rmIfExists(pnpmStore);
  onLog({ stream: 'system', line: '解引用完成' });
}

/**
 * Install an exact @deepseek-ai/dsh version into staging, then swap.
 * Async: streams install logs via onLog; does not block the event loop on pnpm.
 * Caller must stop the harness supervisor first.
 */
async function applyHarnessUpdate(dshVersion, options = {}) {
  if (!dshVersion || typeof dshVersion !== 'string') {
    throw new Error('必须指定精确的 dsh 版本号（含 -rc.N）');
  }
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : noop;
  const onLog = typeof options.onLog === 'function' ? options.onLog : noop;
  const materialize = Boolean(options.materialize);

  setUpdateInFlight(true);
  let swapped = false;
  try {
    onProgress({ stage: 'prepare', message: '准备 staging 目录' });
    onLog({ stream: 'system', line: `目标版本 @deepseek-ai/dsh@${dshVersion}` });
    onLog({ stream: 'system', line: `registry ${npmRegistry()}` });
    const staging = prepareStagingFromCurrent();
    const nodeBinary = nodePathIn(staging);
    writeStagingManifest(staging, dshVersion);
    onLog({ stream: 'system', line: `staging → ${staging}` });

    onProgress({ stage: 'install', message: `安装 @deepseek-ai/dsh@${dshVersion}` });
    await runPnpmInstall(staging, nodeBinary, onLog);

    if (materialize) {
      onProgress({ stage: 'materialize', message: '解引用 node_modules' });
      await materializeNodeModules(staging, onLog);
    } else {
      onLog({
        stream: 'system',
        line: '跳过 node_modules 解引用（运行时可直接使用 pnpm 链接树）',
      });
    }

    if (!harnessRuntimeReady(staging)) {
      const missing = harnessMissingParts(staging).filter((p) => p !== 'version.json');
      throw new Error(`安装后 staging 不完整（缺: ${missing.join(', ') || 'unknown'}）`);
    }
    resolveDshEntryIn(staging);

    onProgress({ stage: 'swap', message: '切换到新版本' });
    onLog({ stream: 'system', line: '原子切换 harness ← staging' });
    const nodeVer = spawnSync(nodeBinary, ['-p', 'process.version'], { encoding: 'utf8' });
    commitStaging({
      dsh: dshVersion,
      node: String(nodeVer.stdout || '')
        .trim()
        .replace(/^v/, '') || null,
      source: 'npm',
      installedAt: new Date().toISOString(),
    });
    swapped = true;

    onProgress({ stage: 'done', message: `已更新到 ${dshVersion}` });
    onLog({ stream: 'system', line: `完成：${dshVersion}` });
    return readVersionJson(harnessRoot());
  } catch (error) {
    onProgress({ stage: 'error', message: String(error.message || error) });
    onLog({ stream: 'system', line: `错误：${error.message || error}` });
    if (swapped || (!harnessLooksComplete(harnessRoot()) && fs.existsSync(harnessPrevRoot()))) {
      try {
        onLog({ stream: 'system', line: '正在回滚到上一版本…' });
        rollbackToPrev();
        onLog({ stream: 'system', line: '已回滚' });
      } catch (rollbackError) {
        error.message = `${error.message}; 回滚也失败: ${rollbackError.message}`;
      }
    } else {
      rmIfExists(harnessStagingRoot());
    }
    throw error;
  } finally {
    setUpdateInFlight(false);
  }
}

async function restoreHarnessFromSeed(options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : noop;
  const onLog = typeof options.onLog === 'function' ? options.onLog : noop;

  if (hasUsableSeed()) {
    setUpdateInFlight(true);
    try {
      onProgress({ stage: 'restore', message: '从本地种子恢复' });
      onLog({ stream: 'system', line: '从本地种子恢复…' });
      await new Promise((r) => setImmediate(r));
      const result = await restoreFromSeed();
      onProgress({ stage: 'done', message: '已从种子恢复' });
      onLog({ stream: 'system', line: `完成：${result.version?.dsh || 'seed'}` });
      return result.version;
    } catch (error) {
      onProgress({ stage: 'error', message: String(error.message || error) });
      onLog({ stream: 'system', line: `错误：${error.message || error}` });
      throw error;
    } finally {
      setUpdateInFlight(false);
    }
  }

  const version = seedDshVersion();
  if (!version) {
    throw new Error('package.json 缺少 dshDesktop.seedDsh，无法重新安装默认版本');
  }
  onLog({ stream: 'system', line: `无本地种子，改为从 npm 安装默认版本 ${version}` });
  return applyHarnessUpdate(version, { onProgress, onLog });
}

/**
 * Ensure writable harness exists: reuse / copy local seed / first-run npm install.
 */
async function ensureHarnessReadyAsync(onProgress = noop, onLog = noop) {
  const root = harnessRoot();
  if (harnessLooksComplete(root)) {
    return { root, created: false, source: readVersionJson(root)?.source || null };
  }
  if (hasUsableSeed()) {
    const result = await ensureHarnessInstalledAsync(onProgress);
    return { ...result, source: 'seed' };
  }
  const version = seedDshVersion();
  if (!version) {
    throw new Error('package.json 缺少 dshDesktop.seedDsh');
  }
  onProgress({ message: `首次启动：正在从 npm 安装 @deepseek-ai/dsh@${version}…` });
  onLog({ stream: 'system', line: `bootstrap @deepseek-ai/dsh@${version}` });
  await applyHarnessUpdate(version, {
    onProgress: (p) => onProgress({ message: p.message || p.stage }),
    onLog,
  });
  return { root, created: true, source: 'npm' };
}

module.exports = {
  isUpdateInFlight,
  setUpdateInFlight,
  npmRegistry,
  fetchDistTags,
  checkHarnessUpdates,
  applyHarnessUpdate,
  restoreHarnessFromSeed,
  ensureHarnessReadyAsync,
  writeStagingManifest,
  runPnpmInstall,
  materializeNodeModules,
};
