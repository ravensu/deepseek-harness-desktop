'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { guessInstalledDshHome } = require('../src/main/paths');

test('guessInstalledDshHome finds DeepSeek Harness dsh-home under APPDATA', () => {
  const roaming = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-appdata-'));
  const prev = process.env.APPDATA;
  process.env.APPDATA = roaming;
  try {
    assert.equal(guessInstalledDshHome(), null);
    const home = path.join(roaming, 'DeepSeek Harness', 'dsh-home');
    fs.mkdirSync(home, { recursive: true });
    assert.equal(guessInstalledDshHome(), home);
  } finally {
    if (prev === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = prev;
    fs.rmSync(roaming, { recursive: true, force: true });
  }
});
