export function createApprovals({ timeoutMs = 5 * 60 * 1000, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) {
  const pending = new Map();

  function has(chatKey) {
    return pending.has(chatKey);
  }

  function peek(chatKey) {
    const row = pending.get(chatKey);
    if (!row) return null;
    return { toolName: row.toolName, argsPreview: row.argsPreview };
  }

  function decide(chatKey, decision) {
    const row = pending.get(chatKey);
    if (!row) return false;
    pending.delete(chatKey);
    clearTimeoutFn(row.timer);
    row.resolve(decision);
    return true;
  }

  function wait(chatKey, { toolName, argsPreview }) {
    if (pending.has(chatKey)) {
      decide(chatKey, 'deny');
    }
    return new Promise((resolve) => {
      const timer = setTimeoutFn(() => {
        decide(chatKey, 'deny');
      }, timeoutMs);
      pending.set(chatKey, { toolName, argsPreview, resolve, timer });
    });
  }

  function clear(chatKey) {
    if (pending.has(chatKey)) decide(chatKey, 'deny');
  }

  return { has, peek, wait, decide, clear };
}
