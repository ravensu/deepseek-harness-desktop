#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { dshHome } = require('../src/main/paths');
const { ensureHarnessPlugins, harnessPluginsRoot } = require('../src/main/ensure-plugin');

const home = dshHome();
const sourceRoot = harnessPluginsRoot();
console.log(`DSH_HOME=${home}`);
console.log(`watching ${sourceRoot}`);
console.log('Host (lib/index.js): restart DeepSeek Harness. Client (lib/client.js): Ctrl+R in the window.\n');

const result = ensureHarnessPlugins(home, { mode: 'link' });
if (!result.ok) {
  for (const fail of result.failed) {
    console.error(`failed: ${fail.reason || fail.plugin}`);
  }
  process.exit(1);
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`harness plugins root missing: ${sourceRoot}`);
  process.exit(1);
}

let timer = null;
fs.watch(sourceRoot, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const rel = String(filename).replace(/\\/g, '/');
  if (rel.includes('node_modules') || rel.includes('.git')) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const r = ensureHarnessPlugins(home, { mode: 'link' });
    const names = (r.results || []).filter((x) => x.ok).map((x) => x.plugin);
    process.stdout.write(`[${new Date().toLocaleTimeString()}] synced ${names.join(', ')}\n`);
  }, 200);
});
