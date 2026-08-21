'use strict';

const READY_RE = /dsh web:\s*(https?:\/\/127\.0\.0\.1:\d+)\b/i;

function parseReadyUrl(line) {
  const match = READY_RE.exec(String(line));
  return match ? match[1] : null;
}

module.exports = { parseReadyUrl };
