'use strict';

/**
 * Fast prestart gate: skip full stage:harness when sidecar/harness already
 * matches package.json dshDesktop.seedDsh. Avoids multi-minute "no response"
 * on every pnpm start.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'sidecar', 'harness');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const seedDsh = manifest.dshDesktop?.seedDsh;

function looksComplete() {
  const node = path.join(dest, 'node', process.platform === 'win32' ? 'node.exe' : 'node');
  const dsh = path.join(dest, 'node_modules', '@deepseek-ai', 'dsh', 'package.json');
  const group = path.join(dest, 'node_modules', '@deepseek-ai', 'cordis-plugin-group', 'package.json');
  if (!fs.existsSync(node) || !fs.existsSync(dsh) || !fs.existsSync(group)) return false;
  try {
    const ver = JSON.parse(fs.readFileSync(path.join(dest, 'version.json'), 'utf8'));
    return Boolean(seedDsh) && ver.dsh === seedDsh;
  } catch {
    return false;
  }
}

if (looksComplete()) {
  console.log(`ensure-harness-staged: 已就绪 @deepseek-ai/dsh@${seedDsh}，跳过 stage`);
  process.exit(0);
}

console.log('ensure-harness-staged: 需要生成 sidecar/harness…');
const result = spawnSync(process.execPath, [path.join(__dirname, 'stage-harness.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
