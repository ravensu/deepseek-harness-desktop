'use strict';

const fs = require('fs');
const path = require('path');
const { isLinkedTo, linkPluginDir, readLinkTarget, removePluginDest } = require('./link-plugin-dir');

const PLUGIN_NAME = 'dsh-desktop-core';

function repoRoot() {
  return path.join(__dirname, '..', '..');
}

/** 壳专用插件根目录：plugins/desktop/<name> */
function desktopPluginsRoot() {
  return path.join(repoRoot(), 'plugins', 'desktop');
}

function looksLikeHarnessPlugins(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return listPluginDirs(dir).length > 0;
}

/**
 * Walk up from a directory looking for plugins/harness.
 * Lets release/win-unpacked reference the repo tree without rebuilding asar.
 */
function findHarnessPluginsNear(startDir) {
  let dir = path.resolve(startDir || '');
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, 'plugins', 'harness');
    if (looksLikeHarnessPlugins(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function bundledHarnessPlugins() {
  if (process.resourcesPath) {
    const bundled = path.join(process.resourcesPath, 'plugins', 'harness');
    if (looksLikeHarnessPlugins(bundled)) return bundled;
  }
  return null;
}

/**
 * 纯 dsh 插件根目录。优先级：
 * 1. DSH_HARNESS_PLUGINS
 * 2. 从 exe 向上找仓库里的 plugins/harness（unpacked 引用源码）
 * 3. resources/plugins/harness（打进安装包的 extraResources）
 * 4. 开发态仓库 plugins/harness
 */
function harnessPluginsRoot() {
  if (process.env.DSH_HARNESS_PLUGINS && process.env.DSH_HARNESS_PLUGINS.trim()) {
    return path.resolve(process.env.DSH_HARNESS_PLUGINS.trim());
  }
  try {
    const { app } = require('electron');
    if (app?.isPackaged) {
      const nearExe = findHarnessPluginsNear(path.dirname(process.execPath));
      if (nearExe) return nearExe;
      const bundled = bundledHarnessPlugins();
      if (bundled) return bundled;
    }
  } catch {
    /* tests / plain node */
  }
  const nearCwd = findHarnessPluginsNear(process.cwd());
  if (nearCwd) return nearCwd;
  return path.join(repoRoot(), 'plugins', 'harness');
}

function shouldForceHarnessRefresh(sourceRoot) {
  if (process.env.DSH_HARNESS_PLUGINS) return true;
  const bundled = bundledHarnessPlugins();
  if (!bundled) return false;
  return path.resolve(sourceRoot) !== path.resolve(bundled);
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
 * Install / refresh one plugin from a source root into the web profile.
 */
function ensurePlugin(dshHome, pluginName, sourceRoot, markerFile = 'lib/index.js', force = false, mode = 'copy') {
  const source = path.join(sourceRoot, pluginName);
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
  const live = Boolean(readLinkTarget(dest));
  const linkedHere = isLinkedTo(dest, source);
  const missingMarker = !fs.existsSync(path.join(dest, markerFile));
  // App startup copies packaged plugins, but never overwrites a live-dev junction.
  // plugin:link / plugin:dev retargets dest at the repo source.
  const needInstall =
    mode === 'link'
      ? !linkedHere
      : !live && (force || destVersion !== srcPkg.version || missingMarker);

  let changed = false;
  if (needInstall) {
    if (mode === 'link') {
      linkPluginDir(source, dest);
    } else {
      removePluginDest(dest);
      copyDirSync(source, dest);
    }
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
    linked: isLinkedTo(dest, source),
  };
}

/**
 * Refresh all plugins under plugins/desktop into the profile.
 * Keeps ensureDesktopCorePlugin() as a stable alias for the core plugin.
 */
function ensurePluginsFrom(dshHome, sourceRoot, markerFile, force = false, mode = 'copy') {
  const names = listPluginDirs(sourceRoot);
  const results = names.map((name) =>
    ensurePlugin(dshHome, name, sourceRoot, markerFile, force, mode),
  );
  const changed = results.some((r) => r.ok && r.changed);
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    changed,
    results,
    failed,
  };
}

function ensureDesktopPlugin(dshHome, pluginName) {
  return ensurePlugin(dshHome, pluginName, desktopPluginsRoot(), 'lib/client.js');
}

function ensureDesktopPlugins(dshHome) {
  return ensurePluginsFrom(dshHome, desktopPluginsRoot(), 'lib/client.js');
}

function ensureHarnessPlugins(dshHome, options = {}) {
  const sourceRoot = harnessPluginsRoot();
  const mode = options.mode === 'link' ? 'link' : 'copy';
  const force = mode === 'link' ? false : shouldForceHarnessRefresh(sourceRoot);
  return {
    ...ensurePluginsFrom(dshHome, sourceRoot, 'lib/index.js', force, mode),
    sourceRoot,
    force,
    mode,
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
  ensureHarnessPlugins,
  pluginSourceRoot,
  desktopPluginsRoot,
  harnessPluginsRoot,
  findHarnessPluginsNear,
  listPluginDirs,
  isLinkedTo,
  linkPluginDir,
  readLinkTarget,
};
