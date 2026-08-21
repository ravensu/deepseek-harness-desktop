window.__ModuleLoader__.load({
  id: 'dsh-desktop-core',
  factory: (require) => {
    const bundleModule = { exports: {} };
    Object.defineProperty(bundleModule.exports, Symbol.toStringTag, { value: 'Module' });
    const { jsx, jsxs, Fragment } = require('react/jsx-runtime');
    const React = require('react');

    const NS = 'dsh-desktop-core';
    const zh = {
      nav: '核心管理',
      title: '核心管理',
      intro: '运行时由桌面壳更新；本页沿用官方设置主题，只负责展示与发起操作。',
      unavailable: '未检测到 DeepSeek Harness Desktop。请从桌面应用打开，而不是浏览器直连。',
      engine: '引擎 (dsh)',
      node: 'Node',
      source: '来源',
      installedAt: '安装时间',
      shell: '桌面壳',
      seed: '默认版本',
      path: '运行时目录',
      data: '数据目录',
      check: '检查更新',
      restore: '重新安装默认版本',
      cleanup: '清理旧版本缓存',
      diagnose: '运行诊断',
      openHarness: '打开运行时目录',
      openData: '打开数据目录',
      install: '安装',
      current: '当前',
      newer: '可更新',
      upToDate: '已是最新',
      hasUpdate: '有更新',
      unknown: '尚未检查',
      log: '更新日志',
      confirmInstall: '将停止 Harness、替换 sidecar 并重启。用户数据保留。继续？',
      confirmRestore: '将重新安装默认 dsh 版本（打包版从 npm；开发态可有本地种子）。当前运行时会先移到 harness.prev。',
      shellNote: '桌面壳需重装安装包更新；此处仅显示版本。首次启动会从网络安装引擎。',
      updates: '可用版本',
      probing: '正在连接桌面壳…',
    };
    const en = {
      nav: 'Core',
      title: 'Core management',
      intro: 'The desktop shell performs updates. This page follows the official settings theme and only displays status and triggers actions.',
      unavailable: 'DeepSeek Harness Desktop was not detected. Open this from the desktop app, not a bare browser.',
      engine: 'Engine (dsh)',
      node: 'Node',
      source: 'Source',
      installedAt: 'Installed',
      shell: 'Desktop shell',
      seed: 'Default version',
      path: 'Runtime path',
      data: 'Data path',
      check: 'Check updates',
      restore: 'Reinstall default version',
      cleanup: 'Clean old caches',
      diagnose: 'Run diagnostics',
      openHarness: 'Open runtime folder',
      openData: 'Open data folder',
      install: 'Install',
      current: 'current',
      newer: 'update',
      upToDate: 'Up to date',
      hasUpdate: 'Update available',
      unknown: 'Not checked',
      log: 'Update log',
      confirmInstall: 'Harness will stop, the sidecar will be replaced, then restart. User data is kept. Continue?',
      confirmRestore: 'Reinstall the default dsh version from npm (or local seed if present). The current tree moves to harness.prev.',
      shellNote: 'Update the desktop shell by reinstalling the app; this page only shows its version. First launch installs the engine from the network.',
      updates: 'Available versions',
      probing: 'Connecting to the desktop shell…',
    };

    // Mirror official settings-models / settings-general tokens (theme-managed).
    const css = `
.DDC_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}
.DDC_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}
.DDC_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}
.DDC_notice{color:var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warning-primary));margin:0;font-size:12px;line-height:18px}
.DDC_ok{color:var(--dsw-alias-state-success-primary);margin:0;font-size:12px;line-height:18px}
.DDC_busy{color:var(--dsw-alias-state-business-primary);margin:0;font-size:12px;line-height:18px}
.DDC_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:18px}
.DDC_rows{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}
.DDC_rowCard{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:10px;padding:12px 14px;display:flex;background:transparent}
.DDC_rowHead{align-items:center;justify-content:space-between;gap:10px;display:flex}
.DDC_rowName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px;margin:0}
.DDC_rowTag{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}
.DDC_rowTag[data-kind=ok]{color:var(--dsw-alias-state-success-primary)}
.DDC_rowTag[data-kind=warn]{color:var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warning-primary))}
.DDC_fields{flex-direction:column;gap:0;display:flex}
.DDC_field{align-items:flex-start;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex}
.DDC_field:last-child{border-bottom:none;padding-bottom:0}
.DDC_field:first-child{padding-top:0}
.DDC_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;flex:none;min-width:88px}
.DDC_fieldValue{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-family:var(--dsw-font-mono, ui-monospace, SFMono-Regular, Consolas, Menlo, monospace);text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.DDC_actions{align-items:center;flex-wrap:wrap;gap:8px;display:flex}
.DDC_btn{box-sizing:border-box;font:inherit;font-size:13px;line-height:20px;cursor:pointer;border-radius:8px;padding:5px 12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1, transparent);color:var(--dsw-alias-label-primary)}
.DDC_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.DDC_btn:disabled{opacity:.45;cursor:default}
.DDC_btnPrimary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-on-primary, #fff)}
.DDC_btnPrimary:hover:not(:disabled){filter:brightness(1.05);background:var(--dsw-alias-state-business-primary)}
.DDC_btnLink{border:none;background:transparent;color:var(--dsw-alias-state-business-primary);padding:5px 8px}
.DDC_btnLink:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.DDC_targets{flex-direction:column;gap:8px;display:flex}
.DDC_target{align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:10px 12px;display:flex}
.DDC_targetMeta{min-width:0;flex:1}
.DDC_targetTag{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;text-transform:uppercase;letter-spacing:.04em}
.DDC_targetVer{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-family:var(--dsw-font-mono, ui-monospace, SFMono-Regular, Consolas, Menlo, monospace)}
.DDC_logLabel{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin:0}
.DDC_log{margin:0;max-height:220px;overflow:auto;background:var(--dsw-alias-markdown-code-block, var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;font-family:var(--dsw-font-mono, ui-monospace, SFMono-Regular, Consolas, Menlo, monospace);font-size:11px;line-height:16px;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
.DDC_warnBox{margin:0;padding:10px 12px;border-radius:8px;border:1px solid color-mix(in srgb, var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warning-primary)) 35%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warning-primary)) 8%, transparent);color:var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warning-primary));font-size:13px;line-height:20px}
`;
    const tagId = 'dsh-desktop-core/CoreSection.css';
    if (typeof document !== 'undefined') {
      let tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']');
      if (!tag) {
        tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-desktop-core';
        tag.dataset.pluginCss = tagId;
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    }

    function getBridge() {
      const desktop = typeof window !== 'undefined' ? window.dshDesktop : null;
      return desktop && desktop.core ? desktop.core : null;
    }

    function waitForBridge(timeoutMs) {
      return new Promise((resolve) => {
        const existing = getBridge();
        if (existing) {
          resolve(existing);
          return;
        }
        let done = false;
        const finish = (value) => {
          if (done) return;
          done = true;
          window.removeEventListener('dsh-desktop-bridge-ready', onReady);
          clearInterval(timer);
          clearTimeout(timeout);
          resolve(value);
        };
        const onReady = () => finish(getBridge());
        window.addEventListener('dsh-desktop-bridge-ready', onReady);
        const timer = setInterval(() => {
          const bridge = getBridge();
          if (bridge) finish(bridge);
        }, 200);
        const timeout = setTimeout(() => finish(null), timeoutMs);
      });
    }

    function fmtDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    function field(label, value) {
      return jsxs('div', {
        className: 'DDC_field',
        children: [
          jsx('div', { className: 'DDC_fieldLabel', children: label }),
          jsx('div', {
            className: 'DDC_fieldValue',
            title: String(value || ''),
            children: value || '—',
          }),
        ],
      });
    }

    function CoreSection(props) {
      const t = props.t || ((k) => k);
      const [bridge, setBridge] = React.useState(() => getBridge());
      const [overview, setOverview] = React.useState(null);
      const [targets, setTargets] = React.useState(null);
      const [registry, setRegistry] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [status, setStatus] = React.useState({ text: '', kind: '' });
      const [log, setLog] = React.useState('');
      const [probeDone, setProbeDone] = React.useState(Boolean(getBridge()));
      const logRef = React.useRef(null);

      const refresh = React.useCallback(async () => {
        if (!bridge) return;
        setOverview(await bridge.overview());
      }, [bridge]);

      const appendLog = React.useCallback((entry) => {
        if (!entry) return;
        const prefix = entry.stream === 'system' ? '· ' : entry.stream === 'stderr' ? '! ' : '  ';
        setLog((prev) => prev + prefix + (entry.line || '') + '\n');
      }, []);

      React.useEffect(() => {
        let cancelled = false;
        waitForBridge(4000).then((found) => {
          if (cancelled) return;
          setBridge(found);
          setProbeDone(true);
        });
        return () => {
          cancelled = true;
        };
      }, []);

      React.useEffect(() => {
        if (!bridge) return undefined;
        const offProgress = bridge.onProgress?.((p) => {
          if (p?.message) setStatus({ text: p.message, kind: p.stage === 'error' ? 'error' : 'busy' });
        });
        const offLog = bridge.onLog?.((entry) => appendLog(entry));
        refresh().catch((error) => setStatus({ text: String(error.message || error), kind: 'error' }));
        return () => {
          offProgress?.();
          offLog?.();
        };
      }, [bridge, refresh, appendLog]);

      React.useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      }, [log]);

      async function check() {
        if (!bridge || busy) return;
        setBusy(true);
        setStatus({ text: t('check') + '…', kind: 'busy' });
        try {
          const result = await bridge.checkHarness();
          setTargets(result.targets || []);
          setRegistry(result.registry || '');
          setStatus({ text: result.registry ? `registry: ${result.registry}` : '', kind: '' });
        } catch (error) {
          setStatus({ text: String(error.message || error), kind: 'error' });
        } finally {
          setBusy(false);
        }
      }

      async function install(version) {
        if (!bridge || busy) return;
        if (!window.confirm(`${t('install')} @deepseek-ai/dsh@${version}?\n${t('confirmInstall')}`)) return;
        setBusy(true);
        setLog('');
        setStatus({ text: `${t('install')} ${version}…`, kind: 'busy' });
        try {
          await bridge.installHarness(version);
          await refresh();
          setStatus({ text: `${t('install')} ${version}`, kind: 'ok' });
          await check();
        } catch (error) {
          setStatus({ text: String(error.message || error), kind: 'error' });
          await refresh().catch(() => {});
        } finally {
          setBusy(false);
        }
      }

      async function restore() {
        if (!bridge || busy) return;
        if (!window.confirm(t('confirmRestore'))) return;
        setBusy(true);
        setLog('');
        setStatus({ text: t('restore') + '…', kind: 'busy' });
        try {
          await bridge.restoreSeed();
          await refresh();
          setTargets(null);
          setStatus({ text: t('restore'), kind: 'ok' });
        } catch (error) {
          setStatus({ text: String(error.message || error), kind: 'error' });
        } finally {
          setBusy(false);
        }
      }

      async function cleanup() {
        if (!bridge || busy) return;
        setBusy(true);
        try {
          const result = await bridge.cleanup();
          const names = (result.removed || []).map((p) => String(p).split(/[/\\]/).pop());
          setStatus({ text: names.length ? names.join(', ') : t('upToDate'), kind: 'ok' });
        } catch (error) {
          setStatus({ text: String(error.message || error), kind: 'error' });
        } finally {
          setBusy(false);
        }
      }

      async function diagnose() {
        if (!bridge || busy) return;
        setBusy(true);
        try {
          const out = await bridge.diagnose();
          setLog((out.ok ? 'ok\n' : 'failed\n') + String(out.stdout || out.stderr || out.error || ''));
          setStatus({ text: out.ok ? 'ok' : 'failed', kind: out.ok ? 'ok' : 'error' });
        } catch (error) {
          setStatus({ text: String(error.message || error), kind: 'error' });
        } finally {
          setBusy(false);
        }
      }

      if (!probeDone) {
        return jsx('section', {
          className: 'DDC_section',
          children: jsx('p', { className: 'DDC_intro', children: t('probing') }),
        });
      }

      if (!bridge) {
        return jsx('section', {
          className: 'DDC_section',
          children: jsx('p', { className: 'DDC_warnBox', children: t('unavailable') }),
        });
      }

      const h = overview?.harness || {};
      const newer = (targets || []).filter((row) => row.newer);
      const badgeKind = !targets ? '' : newer.length ? 'warn' : 'ok';
      const badgeText = !targets
        ? t('unknown')
        : newer.length
          ? `${t('hasUpdate')} (${newer.map((row) => row.tag).join(', ')})`
          : t('upToDate');
      const statusClass =
        status.kind === 'error'
          ? 'DDC_error'
          : status.kind === 'busy'
            ? 'DDC_busy'
            : status.kind === 'ok'
              ? 'DDC_ok'
              : 'DDC_notice';

      return jsxs('section', {
        className: 'DDC_section',
        children: [
          jsx('h2', { className: 'DDC_title', children: t('title') }),
          jsx('p', { className: 'DDC_intro', children: t('intro') }),

          jsxs('ul', {
            className: 'DDC_rows',
            children: [
              jsxs('li', {
                className: 'DDC_rowCard',
                children: [
                  jsxs('div', {
                    className: 'DDC_rowHead',
                    children: [
                      jsx('p', { className: 'DDC_rowName', children: 'DeepSeek Harness' }),
                      jsx('span', {
                        className: 'DDC_rowTag',
                        'data-kind': badgeKind || undefined,
                        children: badgeText,
                      }),
                    ],
                  }),
                  jsxs('div', {
                    className: 'DDC_fields',
                    children: [
                      field(t('engine'), h.dsh ? `v${h.dsh}` : '—'),
                      field(t('node'), h.node || '—'),
                      field(t('source'), h.source || '—'),
                      field(t('installedAt'), fmtDate(h.installedAt)),
                      field(t('seed'), overview?.seedVersion || '—'),
                      field(t('path'), overview?.harnessRoot),
                      field(t('data'), overview?.dshHome),
                    ],
                  }),
                  jsxs('div', {
                    className: 'DDC_actions',
                    children: [
                      jsx('button', {
                        type: 'button',
                        className: 'DDC_btn DDC_btnPrimary',
                        disabled: busy,
                        onClick: () => void check(),
                        children: t('check'),
                      }),
                      jsx('button', {
                        type: 'button',
                        className: 'DDC_btn',
                        disabled: busy,
                        onClick: () => void restore(),
                        children: t('restore'),
                      }),
                      jsx('button', {
                        type: 'button',
                        className: 'DDC_btn',
                        disabled: busy,
                        onClick: () => void cleanup(),
                        children: t('cleanup'),
                      }),
                      jsx('button', {
                        type: 'button',
                        className: 'DDC_btn',
                        disabled: busy,
                        onClick: () => void diagnose(),
                        children: t('diagnose'),
                      }),
                      jsx('button', {
                        type: 'button',
                        className: 'DDC_btn DDC_btnLink',
                        disabled: busy,
                        onClick: () => void bridge.openPath('harness'),
                        children: t('openHarness'),
                      }),
                      jsx('button', {
                        type: 'button',
                        className: 'DDC_btn DDC_btnLink',
                        disabled: busy,
                        onClick: () => void bridge.openPath('data'),
                        children: t('openData'),
                      }),
                    ],
                  }),
                ],
              }),
              jsxs('li', {
                className: 'DDC_rowCard',
                children: [
                  jsx('p', { className: 'DDC_rowName', children: t('shell') }),
                  jsx('p', { className: 'DDC_intro', children: t('shellNote') }),
                  jsxs('div', {
                    className: 'DDC_fields',
                    children: [field(t('shell'), overview?.shellVersion ? `v${overview.shellVersion}` : '—')],
                  }),
                ],
              }),
            ],
          }),

          status.text ? jsx('p', { className: statusClass, children: status.text }) : null,

          targets
            ? jsxs(Fragment, {
                children: [
                  jsx('p', { className: 'DDC_logLabel', children: t('updates') }),
                  jsx('div', {
                    className: 'DDC_targets',
                    children: targets.map((row) =>
                      jsxs(
                        'div',
                        {
                          className: 'DDC_target',
                          children: [
                            jsxs('div', {
                              className: 'DDC_targetMeta',
                              children: [
                                jsx('div', { className: 'DDC_targetTag', children: row.tag }),
                                jsx('div', {
                                  className: 'DDC_targetVer',
                                  children: `${row.version}${
                                    row.same ? ` · ${t('current')}` : row.newer ? ` · ${t('newer')}` : ''
                                  }`,
                                }),
                              ],
                            }),
                            jsx('button', {
                              type: 'button',
                              className: row.same ? 'DDC_btn' : 'DDC_btn DDC_btnPrimary',
                              disabled: busy || row.same,
                              onClick: () => void install(row.version),
                              children: row.same ? t('upToDate') : `${t('install')} ${row.version}`,
                            }),
                          ],
                        },
                        row.tag + row.version,
                      ),
                    ),
                  }),
                ],
              })
            : null,

          log
            ? jsxs(Fragment, {
                children: [
                  jsx('p', {
                    className: 'DDC_logLabel',
                    children: t('log') + (registry ? ` · ${registry}` : ''),
                  }),
                  jsx('pre', { className: 'DDC_log', ref: logRef, children: log }),
                ],
              })
            : null,
        ],
      });
    }

    const inject = ['slots', 'locale'];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-desktop-core: dictionaries');
      const t = ctx.locale.bind(NS);
      ctx.slots.inject(
        'settings.section',
        () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'desktop-core',
              order: 5,
              label: () => t('nav'),
              locale: NS,
            },
            (props) => jsx(CoreSection, { ...props, t }),
          ),
      );
    }

    bundleModule.exports.NS = NS;
    bundleModule.exports.apply = apply;
    bundleModule.exports.inject = inject;
    return bundleModule.exports;
  },
});
