import { splitText } from './split.js';

export function createProgress({ send, gapMs = 15_000, clock = () => Date.now(), split = splitText } = {}) {
  const first = new Set();
  const lastAt = new Map();

  function reset(chatKey) {
    first.delete(chatKey);
    lastAt.delete(chatKey);
  }

  async function onTool(chatKey, name) {
    const now = clock();
    if (!first.has(chatKey)) {
      first.add(chatKey);
      lastAt.set(chatKey, now);
      await send(chatKey, `开始处理：${name}`);
      return true;
    }
    if (now - (lastAt.get(chatKey) || 0) < gapMs) return false;
    lastAt.set(chatKey, now);
    await send(chatKey, `进行中：${name}`);
    return true;
  }

  async function onFinal(chatKey, text) {
    reset(chatKey);
    const body = String(text || '').trim();
    if (!body) {
      await send(chatKey, '本轮完成，无文字回复。');
      return;
    }
    for (const part of split(body)) {
      await send(chatKey, part);
    }
  }

  async function onError(chatKey, message) {
    reset(chatKey);
    await send(chatKey, `出错：${message}`);
  }

  return { reset, onTool, onFinal, onError };
}
