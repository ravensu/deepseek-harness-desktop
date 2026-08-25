import fs from 'node:fs';
import path from 'node:path';
import { BIND_HELP, HELP, parseApprovalReply, parseCommand } from './commands.js';
import { chatKey } from './store.js';

function isAbsoluteDir(cwd, io = fs) {
  if (!cwd || !path.isAbsolute(cwd)) return false;
  try {
    return io.statSync(cwd).isDirectory();
  } catch {
    return false;
  }
}

export function createPipeline({
  store,
  approvals,
  progress,
  agents,
  send,
  defaultCwd = '',
  io = fs,
  log = console,
}) {
  async function reply(key, userId, text) {
    await send({ chatKey: key, userId, text });
  }

  async function handleCommand(key, userId, cmd) {
    const mapping = store.getMapping(key) || {};
    switch (cmd.name) {
      case 'help':
        await reply(key, userId, HELP);
        return;
      case 'cwd': {
        if (!isAbsoluteDir(cmd.arg, io)) {
          await reply(key, userId, BIND_HELP);
          return;
        }
        const cwd = path.resolve(cmd.arg);
        const session = await agents.createSession({ chatKey: key, cwd, yolo: !!mapping.yolo });
        store.putMapping(key, {
          cwd,
          sessionId: session.sessionId,
          yolo: !!mapping.yolo,
          displayName: mapping.displayName || userId,
        });
        await reply(key, userId, `已绑定 ${cwd}\n新会话 ${session.sessionId}`);
        return;
      }
      case 'new': {
        if (!isAbsoluteDir(mapping.cwd, io)) {
          await reply(key, userId, BIND_HELP);
          return;
        }
        const session = await agents.createSession({ chatKey: key, cwd: mapping.cwd, yolo: !!mapping.yolo });
        store.putMapping(key, { ...mapping, sessionId: session.sessionId });
        await reply(key, userId, `新会话 ${session.sessionId}`);
        return;
      }
      case 'status': {
        await reply(
          key,
          userId,
          [
            `cwd: ${mapping.cwd || '(未绑定)'}`,
            `session: ${mapping.sessionId || '(无)'}`,
            `yolo: ${mapping.yolo ? 'on' : 'off'}`,
            `approval: ${approvals.has(key) ? '等待中' : '空闲'}`,
          ].join('\n'),
        );
        return;
      }
      case 'cancel': {
        if (mapping.sessionId) await agents.cancel?.(mapping.sessionId);
        approvals.clear(key);
        await reply(key, userId, '已取消。');
        return;
      }
      case 'yolo': {
        const on = cmd.arg === 'on';
        const off = cmd.arg === 'off';
        if (!on && !off) {
          await reply(key, userId, '用法：/yolo on 或 /yolo off');
          return;
        }
        store.putMapping(key, { ...mapping, yolo: on });
        await reply(key, userId, `yolo ${on ? 'on' : 'off'}`);
        return;
      }
      case 'approve':
      case 'deny': {
        const decision = cmd.name === 'approve' ? 'approve' : 'deny';
        if (!approvals.decide(key, decision)) {
          await reply(key, userId, '当前没有等待中的审批。');
        }
        return;
      }
      default:
        await reply(key, userId, HELP);
    }
  }

  async function handleInbound(inbound) {
    const userId = inbound.userId;
    const key = inbound.chatKey || chatKey(inbound.platform || 'weixin', userId);
    if (inbound.contextToken) store.setContextToken(key, inbound.contextToken);

    if (!store.isAllowed(userId, inbound.platform || 'weixin')) {
      store.rememberDropped(userId, inbound.platform);
      return { dropped: true };
    }

    const text = String(inbound.text || '').trim();
    if (!text) return { ignored: true };

    if (approvals.has(key)) {
      const decision = parseApprovalReply(text);
      if (decision) {
        approvals.decide(key, decision);
        return { approval: decision };
      }
      await reply(key, userId, '请先回复 1 同意或 2 拒绝当前工具调用。');
      return { blocked: 'approval' };
    }

    const cmd = parseCommand(text);
    if (cmd) {
      await handleCommand(key, userId, cmd);
      return { command: cmd.name };
    }

    let mapping = store.getMapping(key) || {};
    if (!isAbsoluteDir(mapping.cwd, io)) {
      if (!isAbsoluteDir(defaultCwd, io)) {
        await reply(key, userId, BIND_HELP);
        return { needCwd: true };
      }
      const cwd = path.resolve(defaultCwd);
      store.putMapping(key, { ...mapping, cwd, displayName: mapping.displayName || userId });
      mapping = store.getMapping(key) || { cwd };
    }

    progress.reset(key);
    try {
      const result = await agents.runTurn({
        chatKey: key,
        userId,
        cwd: mapping.cwd,
        sessionId: mapping.sessionId,
        yolo: !!mapping.yolo,
        text,
        onSessionId(sessionId) {
          store.putMapping(key, { ...store.getMapping(key), sessionId });
        },
        onTool(name) {
          return progress.onTool(key, name);
        },
      });
      if (result?.sessionId) {
        store.putMapping(key, { ...store.getMapping(key), sessionId: result.sessionId });
      }
      await progress.onFinal(key, result?.text || '');
      return { ok: true };
    } catch (err) {
      log.warn?.('[dsh-im-gateway] turn failed', err);
      await progress.onError(key, err instanceof Error ? err.message : String(err));
      return { error: true };
    }
  }

  async function requestToolApproval(key, userId, { toolName, argsPreview, policy }) {
    const mapping = store.getMapping(key) || {};
    if (policy === 'deny') return 'deny';
    if (policy === 'allow' || mapping.yolo) return 'approve';
    const prompt = `需要批准工具 ${toolName}\n${argsPreview || ''}\n回复 1 或 /approve 同意，2 或 /deny 拒绝。`;
    await reply(key, userId, prompt);
    return approvals.wait(key, { toolName, argsPreview });
  }

  return { handleInbound, requestToolApproval };
}
