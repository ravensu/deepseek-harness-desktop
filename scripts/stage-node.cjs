'use strict';

/**
 * Stage a tiny bootstrap toolkit for the packaged shell:
 * - real Node binary
 * - pnpm CLI (so first-run install needs no system Node/npm)
 * Full Harness is installed from npm on first launch.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'sidecar', 'bootstrap-node');
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
const target = path.join(dest, nodeName);

function isElectronBinary(file) {
  const base = path.basename(file).toLowerCase();
  return base.includes('electron');
}

const source = process.env.DSH_BOOTSTRAP_NODE || process.execPath;
if (isElectronBinary(source)) {
  console.error(
    'stage-node: 当前 process.execPath 是 Electron，不能作为 sidecar Node。请用系统 Node 运行本脚本，或设置 DSH_BOOTSTRAP_NODE。',
  );
  process.exit(1);
}

const pnpmSrc = path.join(root, 'node_modules', 'pnpm');
if (!fs.existsSync(path.join(pnpmSrc, 'bin', 'pnpm.cjs'))) {
  console.error('stage-node: 缺少 node_modules/pnpm，请先在仓库根目录 pnpm install');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(source, target);
if (process.platform !== 'win32') {
  fs.chmodSync(target, 0o755);
}

const pnpmDest = path.join(dest, 'pnpm');
fs.cpSync(pnpmSrc, pnpmDest, { recursive: true, dereference: true });

console.log(`stage-node: ok → ${target}`);
console.log(`stage-node: pnpm → ${pnpmDest}`);
