'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseSimpleYaml, mergeFiles, dumpUpdateYaml, main } = require('../scripts/merge-update-yml.cjs');

test('mergeFiles unions mac arch entries', () => {
  const a = parseSimpleYaml(`version: 1.0.0
files:
  - url: dsh-desktop-1.0.0-mac-arm64.zip
    sha512: aaa
    size: 1
path: dsh-desktop-1.0.0-mac-arm64.zip
sha512: aaa
`);
  const b = parseSimpleYaml(`version: 1.0.0
files:
  - url: dsh-desktop-1.0.0-mac-x64.zip
    sha512: bbb
    size: 2
path: dsh-desktop-1.0.0-mac-x64.zip
sha512: bbb
`);
  const merged = mergeFiles([a, b]);
  assert.equal(merged.files.length, 2);
  assert.ok(merged.files.some((f) => f.url.includes('arm64')));
  assert.ok(merged.files.some((f) => f.url.includes('x64')));
  const text = dumpUpdateYaml(merged);
  assert.match(text, /mac-arm64/);
  assert.match(text, /mac-x64/);
});

test('main merges numbered latest-mac yml files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-yml-'));
  fs.writeFileSync(
    path.join(dir, 'latest-mac.0.yml'),
    `version: 1.2.3
files:
  - url: a-arm64.zip
    sha512: a
    size: 1
path: a-arm64.zip
sha512: a
`,
  );
  fs.writeFileSync(
    path.join(dir, 'latest-mac.1.yml'),
    `version: 1.2.3
files:
  - url: b-x64.zip
    sha512: b
    size: 2
path: b-x64.zip
sha512: b
`,
  );
  main(dir);
  const out = fs.readFileSync(path.join(dir, 'latest-mac.yml'), 'utf8');
  assert.match(out, /a-arm64/);
  assert.match(out, /b-x64/);
  assert.equal(fs.existsSync(path.join(dir, 'latest-mac.0.yml')), false);
});
