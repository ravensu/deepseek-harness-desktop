'use strict';

/**
 * Minimal semver compare that understands prerelease (-rc.N).
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] - pb.core[i];
  }
  // No prerelease > any prerelease
  if (!pa.pre && !pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  const len = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xn = Number(x);
    const yn = Number(y);
    if (Number.isFinite(xn) && Number.isFinite(yn)) return xn - yn;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

function parseSemver(input) {
  const raw = String(input || '').trim().replace(/^v/i, '');
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(raw);
  if (!match) {
    return { core: [0, 0, 0], pre: null, raw };
  }
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split('.') : null,
    raw,
  };
}

/**
 * Build selectable update targets from npm dist-tags.
 * Always includes exact versions for latest and next when present.
 */
function listUpdateTargets(currentVersion, distTags) {
  const tags = distTags && typeof distTags === 'object' ? distTags : {};
  const seen = new Set();
  const targets = [];

  const push = (tag, version) => {
    if (!version || seen.has(version)) return;
    seen.add(version);
    const cmp = currentVersion ? compareSemver(version, currentVersion) : 1;
    targets.push({
      tag,
      version,
      newer: cmp > 0,
      same: cmp === 0,
      older: cmp < 0,
    });
  };

  if (tags.latest) push('latest', String(tags.latest));
  if (tags.next) push('next', String(tags.next));

  for (const [tag, version] of Object.entries(tags)) {
    if (tag === 'latest' || tag === 'next') continue;
    push(tag, String(version));
  }

  return targets;
}

module.exports = {
  compareSemver,
  parseSemver,
  listUpdateTargets,
};
