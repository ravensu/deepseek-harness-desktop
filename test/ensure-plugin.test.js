'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ensureDesktopCorePlugin,
  ensureHarnessPlugins,
  findHarnessPluginsNear,
  harnessPluginsRoot,
  isLinkedTo,
  PLUGIN_NAME,
} = require('../src/main/ensure-plugin');

test('ensureDesktopCorePlugin installs into web profile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-'));
  try {
    const first = ensureDesktopCorePlugin(home);
    assert.equal(first.ok, true);
    assert.equal(first.changed, true);
    assert.equal(first.plugin, PLUGIN_NAME);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(home, 'profiles', 'web', 'package.json'), 'utf8'),
    );
    assert.equal(pkg.dependencies[PLUGIN_NAME], first.version);
    assert.ok(pkg.dsh.profile.bundles.includes(PLUGIN_NAME));
    assert.ok(
      fs.existsSync(path.join(home, 'profiles', 'web', 'node_modules', PLUGIN_NAME, 'lib', 'client.js')),
    );

    const second = ensureDesktopCorePlugin(home);
    assert.equal(second.ok, true);
    assert.equal(second.changed, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('ensureDesktopCorePlugin preserves existing bundles', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-'));
  try {
    const profileDir = path.join(home, 'profiles', 'web');
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(
      path.join(profileDir, 'package.json'),
      JSON.stringify(
        {
          name: 'dsh-profile-web',
          private: true,
          dependencies: { 'other-plugin': '1.0.0' },
          dsh: {
            profile: {
              bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'other-plugin'],
            },
          },
        },
        null,
        2,
      ),
    );

    ensureDesktopCorePlugin(home);
    const pkg = JSON.parse(fs.readFileSync(path.join(profileDir, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.dsh.profile.bundles, [
      '@deepseek-ai/dsh-base',
      '@deepseek-ai/dsh-web-app',
      PLUGIN_NAME,
      'other-plugin',
    ]);
    assert.equal(pkg.dependencies['other-plugin'], '1.0.0');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('ensureHarnessPlugins installs im-gateway into web profile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-'));
  try {
    const result = ensureHarnessPlugins(home);
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'copy');
    const im = result.results.find((r) => r.plugin === 'dsh-im-gateway');
    assert.ok(im);
    assert.equal(im.ok, true);
    const pkg = JSON.parse(
      fs.readFileSync(path.join(home, 'profiles', 'web', 'package.json'), 'utf8'),
    );
    assert.ok(pkg.dsh.profile.bundles.includes('dsh-im-gateway'));
    assert.ok(
      fs.existsSync(path.join(home, 'profiles', 'web', 'node_modules', 'dsh-im-gateway', 'lib', 'index.js')),
    );
    assert.ok(
      fs.existsSync(path.join(home, 'profiles', 'web', 'node_modules', 'dsh-im-gateway', 'lib', 'client.js')),
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('ensureHarnessPlugins link mode junctions into the repo source', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-'));
  try {
    const result = ensureHarnessPlugins(home, { mode: 'link' });
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'link');
    const im = result.results.find((r) => r.plugin === 'dsh-im-gateway');
    assert.ok(im);
    assert.equal(im.linked, true);
    const dest = path.join(home, 'profiles', 'web', 'node_modules', 'dsh-im-gateway');
    const source = path.join(harnessPluginsRoot(), 'dsh-im-gateway');
    assert.equal(isLinkedTo(dest, source), true);
    fs.writeFileSync(path.join(source, '.dsh-live-link-probe'), '1');
    try {
      assert.ok(fs.existsSync(path.join(dest, '.dsh-live-link-probe')));
    } finally {
      fs.rmSync(path.join(source, '.dsh-live-link-probe'), { force: true });
    }
    assert.ok(fs.existsSync(path.join(dest, 'lib', 'index.js')));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('ensureHarnessPlugins copy mode preserves an existing live link', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-'));
  try {
    const linked = ensureHarnessPlugins(home, { mode: 'link' });
    assert.equal(linked.ok, true);
    const dest = path.join(home, 'profiles', 'web', 'node_modules', 'dsh-im-gateway');
    const source = path.join(harnessPluginsRoot(), 'dsh-im-gateway');
    const copied = ensureHarnessPlugins(home);
    assert.equal(copied.ok, true);
    assert.equal(copied.mode, 'copy');
    assert.equal(isLinkedTo(dest, source), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('findHarnessPluginsNear walks up from win-unpacked to repo plugins', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-ref-'));
  try {
    const pluginDir = path.join(root, 'plugins', 'harness', 'dsh-im-gateway');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'package.json'), '{"name":"dsh-im-gateway"}\n');
    const unpacked = path.join(root, 'release', 'win-unpacked');
    fs.mkdirSync(unpacked, { recursive: true });
    assert.equal(findHarnessPluginsNear(unpacked), path.join(root, 'plugins', 'harness'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
