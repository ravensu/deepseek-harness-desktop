'use strict';

const fs = require('fs');
const path = require('path');

function normalizePath(p) {
  return path.resolve(p);
}

function readLinkTarget(dest) {
  try {
    const raw = fs.readlinkSync(dest);
    return path.resolve(path.dirname(dest), raw);
  } catch {
    return null;
  }
}

function isLinkedTo(dest, source) {
  const target = readLinkTarget(dest);
  if (!target) return false;
  return normalizePath(target) === normalizePath(source);
}

/**
 * Remove dest without following a junction/symlink into the plugin source tree.
 */
function removePluginDest(dest) {
  try {
    const st = fs.lstatSync(dest);
    if (st.isSymbolicLink()) {
      fs.unlinkSync(dest);
      return;
    }
  } catch {
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
}

/**
 * Point dest at source. Windows uses a directory junction (no admin).
 * Replaces an existing copy or stale link.
 */
function linkPluginDir(source, dest) {
  const src = normalizePath(source);
  if (!fs.existsSync(src)) {
    throw new Error(`plugin source missing: ${src}`);
  }
  if (isLinkedTo(dest, src)) {
    return { changed: false, dest, source: src };
  }
  removePluginDest(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(src, dest, type);
  return { changed: true, dest, source: src };
}

module.exports = {
  readLinkTarget,
  isLinkedTo,
  removePluginDest,
  linkPluginDir,
};
