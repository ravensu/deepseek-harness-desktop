'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'dsh-desktop-core';

function pluginSourceRoot() {
  return path.join(__dirname, '..', '..', 'plugins', PLUGIN_NAME);
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

/**
 * Install / refresh the desktop core plugin into the web profile so it appears
 * under official Settings. Returns whether the profile was modified.
 */
function ensureDesktopCorePlugin(dshHome) {
  const source = pluginSourceRoot();
  if (!fs.existsSync(path.join(source, 'package.json'))) {
    return { ok: false, reason: `plugin source missing: ${source}` };
  }

  const profileDir = path.join(dshHome, 'profiles', 'web');
  fs.mkdirSync(profileDir, { recursive: true });

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
  const bundles = Array.isArray(pkg.dsh.profile.bundles) ? [...pkg.dsh.profile.bundles] : [];

  const dest = path.join(profileDir, 'node_modules', PLUGIN_NAME);
  const srcPkg = readJson(path.join(source, 'package.json'));
  const destPkgPath = path.join(dest, 'package.json');
  const destVersion = fs.existsSync(destPkgPath) ? readJson(destPkgPath).version : null;
  const needCopy = destVersion !== srcPkg.version || !fs.existsSync(path.join(dest, 'lib', 'client.js'));

  let changed = false;
  if (needCopy) {
    fs.rmSync(dest, { recursive: true, force: true });
    copyDirSync(source, dest);
    changed = true;
  }

  if (pkg.dependencies[PLUGIN_NAME] !== srcPkg.version) {
    pkg.dependencies[PLUGIN_NAME] = srcPkg.version;
    changed = true;
  }

  if (!bundles.includes(PLUGIN_NAME)) {
    // Keep official base/app first; append desktop core near the front of extras.
    const baseIdx = bundles.indexOf('@deepseek-ai/dsh-web-app');
    if (baseIdx >= 0) {
      bundles.splice(baseIdx + 1, 0, PLUGIN_NAME);
    } else {
      bundles.push(PLUGIN_NAME);
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
    plugin: PLUGIN_NAME,
    version: srcPkg.version,
    dest,
  };
}

module.exports = {
  PLUGIN_NAME,
  ensureDesktopCorePlugin,
  pluginSourceRoot,
};
