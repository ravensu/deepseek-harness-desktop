'use strict';

/**
 * Sync package.json version from CI tag / env before packaging.
 *
 * Sources (first wins):
 * - DSH_RELEASE_VERSION (explicit, with or without leading v)
 * - GITHUB_REF_NAME when GITHUB_REF_TYPE=tag (GitHub Actions)
 * - CI_COMMIT_TAG (GitLab CI)
 *
 * Example: tag v0.2.0 → package.json version "0.2.0"
 */

const fs = require('fs');
const path = require('path');

function resolveReleaseVersion() {
  const explicit = (process.env.DSH_RELEASE_VERSION || '').trim();
  if (explicit) return explicit.replace(/^v/i, '');

  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    return String(process.env.GITHUB_REF_NAME).replace(/^v/i, '');
  }

  const gitlab = (process.env.CI_COMMIT_TAG || '').trim();
  if (gitlab) return gitlab.replace(/^v/i, '');

  return null;
}

function isSemverLike(version) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const next = resolveReleaseVersion();

if (!next) {
  console.log(`sync-version: 保持 package.json version=${pkg.version}（无 CI tag）`);
  process.exit(0);
}

if (!isSemverLike(next)) {
  console.error(`sync-version: 非法版本 "${next}"（期望如 0.1.0 / 0.1.0-rc.1）`);
  process.exit(1);
}

if (pkg.version === next) {
  console.log(`sync-version: 已是 ${next}`);
  process.exit(0);
}

pkg.version = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`sync-version: ${pkg.version} ← CI`);
