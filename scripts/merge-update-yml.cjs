'use strict';

/**
 * Merge electron-builder latest*.yml from parallel platform jobs.
 * Multiple latest-mac.yml (arm64 + x64) become one files[] list.
 */
const fs = require('fs');
const path = require('path');

function parseSimpleYaml(text) {
  // Minimal parse for electron-builder update info (version, files, path, sha512, releaseDate)
  const lines = String(text).split(/\r?\n/);
  const doc = { files: [] };
  let inFiles = false;
  let current = null;

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    if (/^files:\s*$/.test(line)) {
      inFiles = true;
      continue;
    }

    if (inFiles && /^\s*-\s+url:\s*(.+)\s*$/.test(line)) {
      current = { url: RegExp.$1.trim().replace(/^['"]|['"]$/g, '') };
      doc.files.push(current);
      continue;
    }
    if (inFiles && current && /^\s+(sha512|size|path):\s*(.+)\s*$/.test(line)) {
      const key = RegExp.$1;
      let val = RegExp.$2.trim().replace(/^['"]|['"]$/g, '');
      if (key === 'size') val = Number(val);
      current[key] = val;
      continue;
    }

    if (/^[a-zA-Z]/.test(line)) {
      inFiles = false;
      current = null;
      const m = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (val.startsWith('"') || val.startsWith("'")) val = val.slice(1, -1);
      if (key !== 'files') doc[key] = val;
    }
  }
  return doc;
}

function dumpUpdateYaml(doc) {
  const lines = [];
  lines.push(`version: ${doc.version}`);
  lines.push('files:');
  for (const f of doc.files) {
    lines.push(`  - url: ${f.url}`);
    if (f.sha512) lines.push(`    sha512: ${f.sha512}`);
    if (f.size != null) lines.push(`    size: ${f.size}`);
  }
  const primary = doc.files[0];
  if (primary?.url) lines.push(`path: ${doc.path || primary.url}`);
  if (doc.sha512 || primary?.sha512) lines.push(`sha512: ${doc.sha512 || primary.sha512}`);
  if (doc.releaseDate) lines.push(`releaseDate: '${doc.releaseDate}'`);
  return `${lines.join('\n')}\n`;
}

function mergeFiles(docs) {
  const byUrl = new Map();
  let version = null;
  let releaseDate = null;
  for (const doc of docs) {
    version = version || doc.version;
    releaseDate = releaseDate || doc.releaseDate;
    for (const f of doc.files || []) {
      if (f?.url) byUrl.set(f.url, f);
    }
  }
  const files = [...byUrl.values()].sort((a, b) => String(a.url).localeCompare(String(b.url)));
  return {
    version,
    releaseDate,
    files,
    path: files[0]?.url,
    sha512: files[0]?.sha512,
  };
}

function main(dir) {
  const root = path.resolve(dir || 'upload');
  const groups = new Map();

  for (const name of fs.readdirSync(root)) {
    // latest-mac.0.yml / latest.1.yml
    let m = /^(latest(?:-[\w]+)?)\.(\d+)\.(yml|yaml)$/i.exec(name);
    if (m) {
      const key = `${m[1].toLowerCase()}.yml`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(path.join(root, name));
      continue;
    }
    // latest-mac.yml / latest.yml
    m = /^(latest(?:-[\w]+)?)\.(yml|yaml)$/i.exec(name);
    if (m) {
      const key = `${m[1].toLowerCase()}.yml`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(path.join(root, name));
    }
  }

  for (const [outName, paths] of groups) {
    const unique = [...new Set(paths)];
    const docs = unique.map((p) => parseSimpleYaml(fs.readFileSync(p, 'utf8')));
    const merged = mergeFiles(docs);
    if (!merged.version || merged.files.length < 1) {
      console.warn(`skip merge ${outName}: incomplete`);
      continue;
    }
    const outPath = path.join(root, outName);
    fs.writeFileSync(outPath, dumpUpdateYaml(merged), 'utf8');
    console.log(`merged ${outName} ← ${unique.map((p) => path.basename(p)).join(', ')} (${merged.files.length} files)`);
    for (const p of unique) {
      if (path.resolve(p) !== path.resolve(outPath)) {
        try {
          fs.unlinkSync(p);
        } catch {
          // ignore
        }
      }
    }
  }
}

if (require.main === module) {
  main(process.argv[2]);
}

module.exports = { parseSimpleYaml, mergeFiles, dumpUpdateYaml, main };
