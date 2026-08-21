'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ensureDesktopCorePlugin, PLUGIN_NAME } = require('../src/main/ensure-plugin');

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
