#!/usr/bin/env node
'use strict';

const { dshHome } = require('../src/main/paths');
const { ensureHarnessPlugins } = require('../src/main/ensure-plugin');

const home = dshHome();
console.log(`DSH_HOME=${home}`);
const result = ensureHarnessPlugins(home, { mode: 'link' });
if (!result.ok) {
  for (const fail of result.failed) {
    console.error(`failed: ${fail.reason || fail.plugin}`);
  }
  process.exit(1);
}
for (const item of result.results) {
  if (!item.ok) continue;
  const tag = item.changed ? 'linked' : 'ok';
  console.log(`${tag} ${item.plugin}@${item.version}`);
}
if (result.changed) {
  console.log('\nRestart DeepSeek Harness to load host plugins; Ctrl+R in the window to reload the UI.');
}
