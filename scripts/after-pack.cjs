'use strict';

const fs = require('fs');
const path = require('path');

function resourcesDir(context) {
  if (context.electronPlatformName === 'darwin') {
    const name = context.packager.appInfo.productFilename;
    return path.join(context.appOutDir, `${name}.app`, 'Contents', 'Resources');
  }
  return path.join(context.appOutDir, 'resources');
}

/**
 * Shell-only packaging: ship bootstrap Node + pnpm.
 * Full Harness (@deepseek-ai/dsh) is installed from npm on first launch.
 */
exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, 'sidecar', 'bootstrap-node');
  const nodeName = context.electronPlatformName === 'win32' ? 'node.exe' : 'node';
  const srcNode = path.join(src, nodeName);
  const srcPnpm = path.join(src, 'pnpm', 'bin', 'pnpm.cjs');
  if (!fs.existsSync(srcNode)) {
    throw new Error(`afterPack: 缺少 bootstrap Node: ${srcNode}（请先 node scripts/stage-node.cjs）`);
  }
  if (!fs.existsSync(srcPnpm)) {
    throw new Error(`afterPack: 缺少 bootstrap pnpm: ${srcPnpm}`);
  }

  const dest = path.join(resourcesDir(context), 'bootstrap-node');
  console.log(`afterPack: 复制 bootstrap-node → ${dest}`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
  if (context.electronPlatformName !== 'win32') {
    fs.chmodSync(path.join(dest, nodeName), 0o755);
  }

  const legacySeed = path.join(resourcesDir(context), 'harness-seed');
  if (fs.existsSync(legacySeed)) {
    console.log(`afterPack: 移除旧 harness-seed → ${legacySeed}`);
    fs.rmSync(legacySeed, { recursive: true, force: true });
  }
};
