'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'sidecar', 'harness');
const manifestPath = path.join(root, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const seedDsh = manifest.dshDesktop?.seedDsh;
if (!seedDsh) {
  console.error('package.json 缺少 dshDesktop.seedDsh');
  process.exit(1);
}

const registry = (process.env.DSH_NPM_REGISTRY || 'https://registry.npmjs.org').replace(/\/$/, '');

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyNode() {
  const nodeDir = path.join(dest, 'node');
  fs.mkdirSync(nodeDir, { recursive: true });
  const name = process.platform === 'win32' ? 'node.exe' : 'node';
  const target = path.join(nodeDir, name);
  fs.copyFileSync(process.execPath, target);
  if (process.platform !== 'win32') fs.chmodSync(target, 0o755);
  return target;
}

function writeManifest() {
  const pkg = {
    name: 'dsh-harness-sidecar',
    private: true,
    version: '0.0.0',
    dependencies: {
      '@deepseek-ai/dsh': seedDsh,
      pnpm: '^11.22.0',
    },
  };
  fs.writeFileSync(path.join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  fs.writeFileSync(
    path.join(dest, 'pnpm-workspace.yaml'),
    [
      'nodeLinker: hoisted',
      'allowBuilds:',
      '  "@deepseek-ai/dsh-subprocess-local": true',
      '  "@google/genai": true',
      '  koffi: true',
      '  node-pty: true',
      '  protobufjs: true',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(path.join(dest, '.npmrc'), 'shamefully-hoist=true\n');
}

function installDeps(nodeBinary) {
  const pathWithNode = `${path.dirname(nodeBinary)}${path.delimiter}${process.env.PATH || process.env.Path || ''}`;
  const env = {
    ...process.env,
    npm_config_registry: registry,
    npm_node_execpath: nodeBinary,
    NODE: nodeBinary,
    PATH: pathWithNode,
    Path: pathWithNode,
  };
  console.log(`stage-harness: 安装 @deepseek-ai/dsh@${seedDsh} → ${dest}`);
  // Use corepack/pnpm from PATH when available; else npm exec.
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  let result = spawnSync(pnpmCmd, ['install'], {
    cwd: dest,
    stdio: 'inherit',
    env,
    shell: true,
  });
  if (result.status !== 0) {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    result = spawnSync(npmCmd, ['exec', '--yes', 'pnpm@11.22.0', '--', 'install'], {
      cwd: dest,
      stdio: 'inherit',
      env,
      shell: true,
    });
  }
  if (result.status !== 0) {
    throw new Error(`stage-harness pnpm install 失败: ${result.status}`);
  }
}

function writeVersion(nodeBinary) {
  const ver = spawnSync(nodeBinary, ['-p', 'process.version'], { encoding: 'utf8' });
  const info = {
    dsh: seedDsh,
    node: String(ver.stdout || '')
      .trim()
      .replace(/^v/, ''),
    installedAt: new Date().toISOString(),
    source: 'seed',
  };
  fs.writeFileSync(path.join(dest, 'version.json'), `${JSON.stringify(info, null, 2)}\n`);
}

/**
 * pnpm leaves symlinks/junctions; electron-builder extraResources often skips
 * or breaks them. Materialize a real tree (and drop the virtual store).
 */
function materializeNodeModules() {
  const nm = path.join(dest, 'node_modules');
  if (!fs.existsSync(nm)) throw new Error(`缺少 ${nm}`);
  const linked = path.join(dest, 'node_modules.linked');
  rm(linked);
  fs.renameSync(nm, linked);
  fs.mkdirSync(nm, { recursive: true });
  console.log('stage-harness: 解引用 node_modules…');
  fs.cpSync(linked, nm, { recursive: true, dereference: true });
  rm(linked);
  const pnpmStore = path.join(nm, '.pnpm');
  if (fs.existsSync(pnpmStore)) rm(pnpmStore);
}

function verify() {
  const dshPkg = path.join(dest, 'node_modules', '@deepseek-ai', 'dsh', 'package.json');
  const group = path.join(dest, 'node_modules', '@deepseek-ai', 'cordis-plugin-group', 'package.json');
  if (!fs.existsSync(dshPkg)) throw new Error(`缺少 ${dshPkg}`);
  if (!fs.existsSync(group)) {
    throw new Error(`缺少 cordis-plugin-group: ${group}`);
  }
  const nodeBinary = path.join(dest, 'node', process.platform === 'win32' ? 'node.exe' : 'node');
  const help = spawnSync(
    nodeBinary,
    [path.join(dest, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '--help'],
    { cwd: dest, encoding: 'utf8' },
  );
  if (help.status !== 0) {
    throw new Error(`dsh --help 失败:\n${help.stderr || help.stdout}`);
  }
}

rm(dest);
fs.mkdirSync(dest, { recursive: true });
const nodeBinary = copyNode();
writeManifest();
installDeps(nodeBinary);
materializeNodeModules();
writeVersion(nodeBinary);
verify();
console.log(`stage-harness: ok → ${dest}`);
