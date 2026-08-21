'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'scripts', 'sync-version-from-ci.cjs');
const repoPkg = path.join(__dirname, '..', 'package.json');

test('sync-version-from-ci updates package.json from DSH_RELEASE_VERSION', () => {
  const original = fs.readFileSync(repoPkg, 'utf8');
  const pkg = JSON.parse(original);
  const backup = pkg.version;
  try {
    const result = spawnSync(process.execPath, [script], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DSH_RELEASE_VERSION: 'v9.8.7-rc.1' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const next = JSON.parse(fs.readFileSync(repoPkg, 'utf8'));
    assert.equal(next.version, '9.8.7-rc.1');
  } finally {
    pkg.version = backup;
    fs.writeFileSync(repoPkg, `${JSON.stringify(pkg, null, 2)}\n`);
  }
});

test('sync-version-from-ci rejects invalid versions', () => {
  const result = spawnSync(process.execPath, [script], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DSH_RELEASE_VERSION: 'not-a-version' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
});
