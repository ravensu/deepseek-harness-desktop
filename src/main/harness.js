'use strict';

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const readline = require('readline');
const { parseReadyUrl } = require('./parse');
const { isUpdateInFlight } = require('./update');

class HarnessSupervisor extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.child = null;
    this.url = null;
    this.stopping = false;
    this.restarts = 0;
    this.restartTimer = null;
  }

  start() {
    if (this.child) return;
    if (isUpdateInFlight()) {
      this.emit('log', {
        stream: 'system',
        line: '更新进行中，跳过启动 harness',
      });
      return;
    }
    this.stopping = false;

    const { nodePath, dshEntry, dshHome, cwd, env } = this.options;
    const child = spawn(
      nodePath,
      [dshEntry, 'web', '--no-open', '--port', '0', '--host', '127.0.0.1'],
      {
        cwd,
        env: { ...env, DSH_HOME: dshHome },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    this.child = child;
    this.url = null;
    this.emit('log', { stream: 'system', line: `启动 harness pid=${child.pid}` });

    const attach = (stream, input) => {
      readline.createInterface({ input }).on('line', (line) => {
        this.emit('log', { stream, line });
        const url = parseReadyUrl(line);
        if (url && !this.url) {
          this.url = url;
          this.restarts = 0;
          this.emit('ready', { url });
        }
      });
    };

    attach('stdout', child.stdout);
    attach('stderr', child.stderr);

    child.on('error', (error) => {
      this.emit('error', error);
    });

    child.on('exit', (code, signal) => {
      const expected = this.stopping;
      this.child = null;
      this.emit('exit', { code, signal, expected });
      if (expected) return;
      if (isUpdateInFlight()) {
        this.emit('log', {
          stream: 'system',
          line: '更新进行中，不自动重启 harness',
        });
        return;
      }
      const delay = Math.min(8000, 500 * 2 ** this.restarts);
      this.restarts += 1;
      this.emit('log', {
        stream: 'system',
        line: `harness 意外退出 code=${code}，${delay}ms 后重启`,
      });
      this.restartTimer = setTimeout(() => this.start(), delay);
    });
  }

  async stop() {
    this.stopping = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const child = this.child;
    if (!child) {
      this.url = null;
      return;
    }

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      child.once('exit', finish);
      killProcessTree(child.pid);
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // already gone
        }
        finish();
      }, 8000);
    });

    this.child = null;
    this.url = null;
  }

  async restart() {
    await this.stop();
    this.start();
    return await waitForReady(this, 120000);
  }

  /** Refresh spawn options after sidecar path/version change. */
  reconfigure(options) {
    this.options = { ...this.options, ...options };
  }
}

function waitForReady(harness, timeoutMs) {
  if (harness.url) return Promise.resolve(harness.url);
  return new Promise((resolve, reject) => {
    const onReady = ({ url }) => {
      cleanup();
      resolve(url);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Harness 在 ${Math.round(timeoutMs / 1000)}s 内没有就绪`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      harness.off('ready', onReady);
      harness.off('error', onError);
    };
    harness.once('ready', onReady);
    harness.once('error', onError);
  });
}

function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

module.exports = { HarnessSupervisor, waitForReady };
