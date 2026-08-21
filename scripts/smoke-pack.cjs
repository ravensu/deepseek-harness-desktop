'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function packagedResources(outDir, platform) {
  if (platform === 'darwin') {
    return firstExisting([
      path.join(outDir, 'mac-arm64', 'DeepSeek Harness.app', 'Contents', 'Resources'),
      path.join(outDir, 'mac', 'DeepSeek Harness.app', 'Contents', 'Resources'),
      path.join(outDir, 'mac-x64', 'DeepSeek Harness.app', 'Contents', 'Resources'),
    ]);
  }
  if (platform === 'linux') {
    return firstExisting([
      path.join(outDir, 'linux-unpacked', 'resources'),
      path.join(outDir, 'linux-arm64-unpacked', 'resources'),
      path.join(outDir, 'linux-x64-unpacked', 'resources'),
    ]);
  }
  return firstExisting([
    path.join(outDir, 'win-unpacked', 'resources'),
    path.join(outDir, 'win-arm64-unpacked', 'resources'),
  ]);
}

function smoke(outDir) {
  const platform = process.platform;
  const resources = packagedResources(outDir, platform);
  const bootstrap = path.join(resources, 'bootstrap-node');
  const nodePath = path.join(bootstrap, process.platform === 'win32' ? 'node.exe' : 'node');
  const legacySeed = path.join(resources, 'harness-seed');

  if (!fs.existsSync(nodePath)) {
    throw new Error(`缺少 bootstrap-node: ${nodePath}`);
  }
  const pnpm = path.join(bootstrap, 'pnpm', 'bin', 'pnpm.cjs');
  if (!fs.existsSync(pnpm)) {
    throw new Error(`缺少 bootstrap pnpm: ${pnpm}`);
  }
  if (fs.existsSync(legacySeed)) {
    throw new Error(`安装包不应再包含 harness-seed: ${legacySeed}`);
  }

  const probe = spawnSync(nodePath, ['-p', 'process.version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    throw new Error(`bootstrap Node 无法运行:\n${probe.stderr || probe.stdout}`);
  }

  const asar = path.join(resources, 'app.asar');
  if (!fs.existsSync(asar) && !fs.existsSync(path.join(resources, 'app'))) {
    throw new Error(`缺少 app 资源: ${resources}`);
  }

  console.log(`pack smoke: ok (bootstrap Node ${String(probe.stdout || '').trim()})`);
}

module.exports = { smoke, packagedResources };

if (require.main === module) {
  smoke(path.join(__dirname, '..', 'release'));
}
