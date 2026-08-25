export const HELP = [
  'IM 网关命令：',
  '/cwd <绝对路径>  绑定工作目录并新开会话',
  '/new             同目录新开会话',
  '/status          当前目录 / 会话 / 审批模式',
  '/cancel          取消本轮',
  '/yolo on|off     跳过「询问」类工具审批',
  '/approve 或 1    同意当前工具',
  '/deny 或 2       拒绝当前工具',
  '/help            本说明',
].join('\n');

export const BIND_HELP =
  '还没有绑定工作目录。发送：\n/cwd <本机绝对路径>\n（目录必须已经存在）';

export function parseCommand(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('/')) return null;
  const parts = t.split(/\s+/);
  const name = parts[0].slice(1).toLowerCase();
  const arg = parts.slice(1).join(' ').trim();
  return { name, arg, raw: t };
}

export function parseApprovalReply(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t === '1' || t === '/approve' || t === 'approve' || t === 'y' || t === 'yes' || t === '是') {
    return 'approve';
  }
  if (t === '2' || t === '/deny' || t === 'deny' || t === 'n' || t === 'no' || t === '否') {
    return 'deny';
  }
  return null;
}
