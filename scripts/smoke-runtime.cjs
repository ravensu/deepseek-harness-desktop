'use strict';

/**
 * End-to-end smoke (no Electron UI): ensure writable harness, spawn dsh web,
 * wait for ready URL, HTTP GET /, then shut down.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const readline = require('readline');

const {
  harnessRoot,
  harnessSeedRoot,
  ensureHarnessInstalledAsync,
  resolveNode,
  resolveDshEntry,
  dshHome,
  workspaceDir,
  withLocalBins,
  readVersionJson,
  harnessLooksComplete,
} = require('../src/main/paths');
const { parseReadyUrl } = require('../src/main/parse');

const READY_MS = 120000;

async function main() {
  const seed = harnessSeedRoot();
  if (!harnessLooksComplete(seed)) {
    throw new Error(`开发种子不完整: ${seed}（先 pnpm run stage:harness）`);
  }

  console.log(`[smoke] seed=${seed}`);
  console.log(`[smoke] writable=${harnessRoot()}`);

  const result = await ensureHarnessInstalledAsync((p) => console.log(`[smoke] ${p.message}`));
  console.log(`[smoke] ensure created=${result.created} version=`, readVersionJson(harnessRoot()));

  if (!harnessLooksComplete(harnessRoot())) {
    throw new Error('writable harness 仍不完整');
  }

  const nodePath = resolveNode();
  const dshEntry = resolveDshEntry();
  const home = process.env.DSH_HOME || path.join(__dirname, '..', '.dev-home');
  fs.mkdirSync(home, { recursive: true });
  const cwd = workspaceDir(home);
  const env = withLocalBins(process.env, harnessRoot(), nodePath);

  console.log(`[smoke] spawn ${nodePath} ${dshEntry} web …`);
  const child = spawn(nodePath, [dshEntry, 'web', '--no-open', '--port', '0', '--host', '127.0.0.1'], {
    cwd,
    env: { ...env, DSH_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`超时 ${READY_MS}ms 未就绪`)), READY_MS);
    const onLine = (stream) => (line) => {
      console.log(`[harness:${stream}] ${line}`);
      const u = parseReadyUrl(line);
      if (u) {
        clearTimeout(timer);
        resolve(u);
      }
    };
    readline.createInterface({ input: child.stdout }).on('line', onLine('stdout'));
    readline.createInterface({ input: child.stderr }).on('line', onLine('stderr'));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`harness 提前退出 code=${code}`));
    });
  });

  console.log(`[smoke] ready ${url}`);
  const status = await new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on('error', reject);
  });
  console.log(`[smoke] GET / → ${status}`);
  if (status < 200 || status >= 500) {
    throw new Error(`意外 HTTP 状态 ${status}`);
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
  console.log('[smoke] ok');
}

main().catch((error) => {
  console.error('[smoke] FAIL', error);
  process.exit(1);
});
