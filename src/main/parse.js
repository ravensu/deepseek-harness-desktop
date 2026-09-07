'use strict';

// 新版内核会在 URL 上挂认证参数（…/?token=xxx），必须整体捕获，
// 否则壳会加载无 token 的地址而被 401 拒绝。
// 用 RFC 3986 白名单匹配 URL 尾部，天然排除空白、引号与 ANSI 控制序列。
const READY_RE = /dsh web:\s*(https?:\/\/127\.0\.0\.1:\d+(?:[/?#][-A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%]*)?)/i;

function parseReadyUrl(line) {
  const match = READY_RE.exec(String(line));
  return match ? match[1] : null;
}

module.exports = { parseReadyUrl };
