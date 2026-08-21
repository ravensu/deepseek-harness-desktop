'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

require('./sync-version-from-ci.cjs');
require('./stage-node.cjs');

const FLAG_TO_PLATFORM = {
  '--win': 'win32',
  '--mac': 'darwin',
  '--linux': 'linux',
};

const args = process.argv.slice(2);
const flags = args.length > 0 ? args : defaultFlags();

function defaultFlags() {
  if (process.platform === 'win32') return ['--win'];
  if (process.platform === 'darwin') return ['--mac'];
  return ['--linux'];
}

const allowCross = process.env.DSH_DIST_CROSS === '1';
for (const flag of flags) {
  const required = FLAG_TO_PLATFORM[flag];
  if (required && required !== process.platform && !allowCross) {
    console.error(
      `请在 ${required} 上执行打包（当前是 ${process.platform}）。原生模块无法交叉编译。若仅调试 electron-builder，可设置 DSH_DIST_CROSS=1。`,
    );
    process.exit(1);
  }
}

const result = spawnSync('pnpm', ['exec', 'electron-builder', ...flags], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY || 'false',
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status) {
  process.exit(result.status);
}

try {
  require('./smoke-pack.cjs').smoke(path.join(__dirname, '..', 'release'));
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
