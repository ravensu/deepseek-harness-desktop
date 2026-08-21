'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'dsh-desktop-core';

function repoRoot() {
  return path.join(__dirname, '..', '..');
}

/** 壳专用插件根目录：plugins/desktop/<name> */
function desktopPluginsRoot() {
  return path.join(repoRoot(), 'plugins', 'desktop');
}

/** 纯 dsh 插件根目录：plugins/harness/<name> */
function harnessPluginsRoot() {
  return path.join(repoRoot(), 'plugins', 'harness');
}

function pluginSourceRoot(name = PLUGIN_NAME) {
  return path.join(desktopPluginsRoot(), name);
}

function listPluginDirs(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(root, name, 'package.json')));
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureProfilePackage(profileDir) {
  const pkgPath = path.join(profileDir, 'package.json');
  let pkg;
  if (fs.existsSync(pkgPath)) {
    pkg = readJson(pkgPath);
  } else {
    pkg = {
      name: 'dsh-profile-web',
      private: true,
      dependencies: {},
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
    };
  }
  pkg.dependencies = pkg.dependencies || {};
  pkg.dsh = pkg.dsh || {};
  pkg.dsh.profile = pkg.dsh.profile || {};
  if (!Array.isArray(pkg.dsh.profile.bundles)) {
    pkg.dsh.profile.bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];
  }
  return { pkgPath, pkg };
}

/**
 * Install / refresh one desktop plugin into the web profile.
 */
function ensureDesktopPlugin(dshHome, pluginName) {
  const source = pluginSourceRoot(pluginName);
  if (!fs.existsSync(path.join(source, 'package.json'))) {
    return { ok: false, reason: `plugin source missing: ${source}` };
  }

  const profileDir = path.join(dshHome, 'profiles', 'web');
  fs.mkdirSync(profileDir, { recursive: true });
  const { pkgPath, pkg } = ensureProfilePackage(profileDir);
  const bundles = [...pkg.dsh.profile.bundles];

  const dest = path.join(profileDir, 'node_modules', pluginName);
  const srcPkg = readJson(path.join(source, 'package.json'));
  const destPkgPath = path.join(dest, 'package.json');
  const destVersion = fs.existsSync(destPkgPath) ? readJson(destPkgPath).version : null;
  const needCopy =
    destVersion !== srcPkg.version || !fs.existsSync(path.join(dest, 'lib', 'client.js'));

  let changed = false;
  if (needCopy) {
    fs.rmSync(dest, { recursive: true, force: true });
    copyDirSync(source, dest);
    changed = true;
  }

  if (pkg.dependencies[pluginName] !== srcPkg.version) {
    pkg.dependencies[pluginName] = srcPkg.version;
    changed = true;
  }

  if (!bundles.includes(pluginName)) {
    const baseIdx = bundles.indexOf('@deepseek-ai/dsh-web-app');
    if (baseIdx >= 0) {
      bundles.splice(baseIdx + 1, 0, pluginName);
    } else {
      bundles.push(pluginName);
    }
    pkg.dsh.profile.bundles = bundles;
    changed = true;
  }

  if (changed) {
    writeJson(pkgPath, pkg);
  }

  return {
    ok: true,
    changed,
    plugin: pluginName,
    version: srcPkg.version,
    dest,
  };
}

/**
 * Refresh all plugins under plugins/desktop into the profile.
 * Keeps ensureDesktopCorePlugin() as a stable alias for the core plugin.
 */
function ensureDesktopPlugins(dshHome) {
  const names = listPluginDirs(desktopPluginsRoot());
  const results = names.map((name) => ensureDesktopPlugin(dshHome, name));
  const changed = results.some((r) => r.ok && r.changed);
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    changed,
    results,
    failed,
  };
}

function ensureDesktopCorePlugin(dshHome) {
  return ensureDesktopPlugin(dshHome, PLUGIN_NAME);
}

module.exports = {
  PLUGIN_NAME,
  ensureDesktopCorePlugin,
  ensureDesktopPlugin,
  ensureDesktopPlugins,
  pluginSourceRoot,
  desktopPluginsRoot,
  harnessPluginsRoot,
  listPluginDirs,
};
