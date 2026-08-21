'use strict';

/**
 * Link plugins/harness/* into a dsh web profile for local development.
 *
 * Usage:
 *   node scripts/link-harness-plugins.cjs
 *   DSH_HOME=... node scripts/link-harness-plugins.cjs
 */

const fs = require('fs');
const path = require('path');
const { harnessPluginsRoot, listPluginDirs } = require('../src/main/ensure-plugin');
const { dshHome } = require('../src/main/paths');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function main() {
  const home = process.env.DSH_HOME || dshHome();
  const profileDir = path.join(home, 'profiles', 'web');
  fs.mkdirSync(path.join(profileDir, 'node_modules'), { recursive: true });

  const pkgPath = path.join(profileDir, 'package.json');
  let pkg = fs.existsSync(pkgPath)
    ? readJson(pkgPath)
    : {
        name: 'dsh-profile-web',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
      };
  pkg.dependencies = pkg.dependencies || {};
  pkg.dsh = pkg.dsh || {};
  pkg.dsh.profile = pkg.dsh.profile || {};
  const bundles = Array.isArray(pkg.dsh.profile.bundles)
    ? [...pkg.dsh.profile.bundles]
    : ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];

  const root = harnessPluginsRoot();
  const names = listPluginDirs(root);
  if (names.length === 0) {
    console.log(`link-harness-plugins: ${root} 下暂无插件包`);
    return;
  }

  for (const name of names) {
    const source = path.join(root, name);
    const srcPkg = readJson(path.join(source, 'package.json'));
    const dest = path.join(profileDir, 'node_modules', name);
    fs.rmSync(dest, { recursive: true, force: true });
    copyDirSync(source, dest);
    pkg.dependencies[name] = srcPkg.version || '0.0.0';
    if (!bundles.includes(name)) bundles.push(name);
    console.log(`linked ${name}@${srcPkg.version} → ${dest}`);
  }

  pkg.dsh.profile.bundles = bundles;
  writeJson(pkgPath, pkg);
  console.log(`profile: ${pkgPath}`);
}

main();
