window.__ModuleLoader__.load({
  id: 'dsh-im-gateway',
  factory: (require) => {
    const bundleModule = { exports: {} };
    Object.defineProperty(bundleModule.exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    const e = React.createElement;

    const css = `
.Dig_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:16px;display:flex}
.Dig_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}
.Dig_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}
.Dig_h{color:var(--dsw-alias-label-primary);margin:4px 0 0;font-size:13px;font-weight:500;line-height:20px}
.Dig_row{flex-direction:column;gap:6px;display:flex}
.Dig_label{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.Dig_pre{white-space:pre-wrap;word-break:break-all;margin:0;font-size:12px;line-height:18px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px}
.Dig_ta,.Dig_in{box-sizing:border-box;width:100%;font:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}
.Dig_ta{min-height:88px}
.Dig_actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.Dig_btn{box-sizing:border-box;font:inherit;font-size:13px;line-height:20px;cursor:pointer;border-radius:8px;padding:5px 12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1, transparent);color:var(--dsw-alias-label-primary)}
.Dig_btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.Dig_btn:disabled{opacity:.45;cursor:not-allowed}
.Dig_link{font:inherit;font-size:13px;line-height:20px;cursor:pointer;border:0;background:none;padding:0;color:var(--dsw-alias-state-business-primary)}
.Dig_link:hover{text-decoration:underline}
.Dig_qr{width:180px;height:180px;object-fit:contain;border-radius:8px;background:#fff}
.Dig_list{margin:0;padding:0;list-style:none;flex-direction:column;gap:6px;display:flex}
.Dig_item{display:flex;gap:8px;align-items:center;justify-content:space-between;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;font-size:13px}
.Dig_meta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin:0;word-break:break-all}
.Dig_gws{margin:0;padding:0;list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;overflow:hidden}
.Dig_gw{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;cursor:pointer;border:0;border-bottom:1px solid var(--dsw-alias-border-l2);width:100%;box-sizing:border-box;background:transparent;color:inherit;text-align:left;font:inherit}
.Dig_gw:last-child{border-bottom:0}
.Dig_gw:hover,.Dig_gw[data-sel=true]{background:var(--dsw-alias-interactive-bg-hover)}
.Dig_icon{width:36px;height:36px;border-radius:10px;flex:none;display:grid;place-items:center;font-size:12px;font-weight:600;color:#fff;letter-spacing:.02em}
.Dig_gwMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.Dig_gwHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.Dig_gwName{font-size:14px;line-height:22px;font-weight:500}
.Dig_badge{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;flex:none}
.Dig_badge[data-kind=connected]{color:#3dd68c;border-color:#3dd68c}
.Dig_badge[data-kind=signedout]{color:var(--dsw-alias-label-secondary)}
.Dig_badge[data-kind=disabled],.Dig_badge[data-kind=coming]{color:var(--dsw-alias-label-tertiary)}
.Dig_gwHint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin:0}
.Dig_gwLinks{display:flex;gap:12px;margin-top:6px}
.Dig_switch{width:40px;height:22px;border-radius:999px;border:0;padding:2px;cursor:pointer;background:var(--dsw-alias-fill-tertiary, rgba(255,255,255,.12));flex:none;margin-top:2px}
.Dig_switch[data-on=true]{background:var(--dsw-alias-state-business-primary, #7c5cfc)}
.Dig_switch::after{content:'';display:block;width:18px;height:18px;border-radius:50%;background:#fff;margin-left:0;transition:margin .15s}
.Dig_switch[data-on=true]::after{margin-left:18px}
.Dig_switch:disabled{opacity:.38;cursor:not-allowed}
`;
    const cssTagId = 'dsh-im-gateway/ui.css';
    if (typeof document !== 'undefined') {
      let tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(cssTagId) + ']');
      if (!tag) {
        tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-im-gateway';
        tag.dataset.pluginCss = cssTagId;
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    }

    const NS = 'im-gateway';
    const CATALOG = [
      { id: 'weixin', nameKey: 'weixin', hintKey: 'weixinHint', mark: '微', color: '#07c160', toggleable: true },
      { id: 'lark', nameKey: 'lark', hintKey: 'larkHint', mark: '飞', color: '#3370ff', toggleable: true },
    ];
    const zh = {
      nav: 'IM 网关',
      title: '网关设置',
      intro: '桌面开着时，用即时通讯驱动本机 Agent。点开通道再配置登录与权限。',
      back: '返回',
      configure: '配置',
      connected: '已连接',
      disconnected: '未登录',
      disabled: '未启用',
      weixin: '微信',
      lark: '飞书 / Lark',
      weixinHint: '私聊。扫码登录 iLink 机器人。',
      larkHint: '私聊。用自建应用长连接收消息。',
      weixinDetailHint: '扫码登录后，允许名单里的人可以私聊驱动本机 Agent。权限规则以后再定。',
      larkDetailHint: '开放平台：自建应用、启用机器人、事件订阅选长连接、订阅 im.message.receive_v1、开通发/读消息权限。App ID 形如 cli_ 加 16 位十六进制。群聊和卡片下一期。',
      appId: 'App ID',
      appSecret: 'App Secret',
      encryptKey: 'Encrypt Key（可选）',
      verificationToken: 'Verification Token（可选）',
      secretKept: '已保存，留空则不改',
      saveConfig: '保存凭证',
      larkError: '连接错误',
      larkAllowlist: '谁可以说话（每行一个 open_id）',
      scan: '扫码登录',
      refresh: '刷新',
      logout: '退出登录',
      qrHint: '用微信扫描。内容也可以是一段 wx 链接。',
      allowlist: '谁可以说话（暂用允许名单，每行一个 userId）',
      save: '保存名单',
      mappings: '会话映射',
      unbind: '解绑',
      none: '（无）',
      dropped: '最近忽略（可复制到名单）',
    };
    const en = {
      nav: 'IM gateway',
      title: 'Gateway settings',
      intro: 'Drive the local agent from chat apps while the desktop is open. Open a channel to configure sign-in and access.',
      back: 'Back',
      configure: 'Configure',
      connected: 'Connected',
      disconnected: 'Signed out',
      disabled: 'Disabled',
      weixin: 'WeChat',
      lark: 'Feishu / Lark',
      weixinHint: 'Direct messages. Scan to sign in the iLink bot.',
      larkHint: 'Direct messages over the official persistent connection.',
      weixinDetailHint: 'After you scan in, people on the allowlist can drive the local agent in DMs. Access rules come later.',
      larkDetailHint: 'Open platform: custom app, enable the bot, subscribe with a persistent connection, add im.message.receive_v1, and grant send/read message scopes. Groups and cards come later.',
      appId: 'App ID',
      appSecret: 'App Secret',
      encryptKey: 'Encrypt Key (optional)',
      verificationToken: 'Verification Token (optional)',
      secretKept: 'Saved; leave blank to keep',
      saveConfig: 'Save credentials',
      larkError: 'Connection error',
      larkAllowlist: 'Who can talk (one open_id per line)',
      scan: 'Scan to sign in',
      refresh: 'Refresh',
      logout: 'Sign out',
      qrHint: 'Scan with WeChat. The payload may be a wx:// URL.',
      allowlist: 'Who can talk (temporary allowlist, one user id per line)',
      save: 'Save list',
      mappings: 'Session mappings',
      unbind: 'Unbind',
      none: '(none)',
      dropped: 'Recently ignored (copy into the allowlist)',
    };

    function qrSrc(qr) {
      const payload = qr?.payload || qr?.qrcode || '';
      if (!payload) return '';
      if (/^https?:\/\//.test(payload) && /\.(png|jpg|jpeg|gif)(\?|$)/i.test(payload)) return payload;
      if (payload.startsWith('data:')) return payload;
      return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
    }

    async function api(path, opts) {
      const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    }

    function mergePlatforms(status) {
      const rows = ((status && status.platforms) || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
      if (!rows.weixin) {
        rows.weixin = {
          id: 'weixin',
          available: true,
          enabled: true,
          connected: Boolean(status && status.connected),
          botId: (status && status.botId) || null,
        };
      }
      return CATALOG.map((meta) => {
        const row = rows[meta.id] || { id: meta.id, available: false, enabled: false, connected: false, botId: null };
        return Object.assign({}, meta, row);
      });
    }

    function pillKind(p) {
      if (!p.available) return 'coming';
      if (!p.enabled) return 'disabled';
      if (p.connected) return 'connected';
      return 'signedout';
    }

    function pillText(t, kind) {
      if (kind === 'connected') return t('connected');
      if (kind === 'signedout') return t('disconnected');
      if (kind === 'coming') return t('coming');
      return t('disabled');
    }

    function Switch({ on, disabled, onClick }) {
      return e('button', {
        type: 'button',
        className: 'Dig_switch',
        'data-on': on ? 'true' : 'false',
        disabled: disabled || undefined,
        'aria-pressed': on ? 'true' : 'false',
        onClick,
      });
    }

    function field({ label, value, onChange, type, placeholder }) {
      return e(
        'div',
        { className: 'Dig_row' },
        e('label', { className: 'Dig_label' }, label),
        e('input', {
          className: 'Dig_in',
          type: type || 'text',
          value,
          placeholder: placeholder || '',
          autoComplete: 'off',
          onChange: (ev) => onChange(ev.target.value),
        }),
      );
    }

    function mappingList(t, mappings, load) {
      if (!mappings.length) return e('p', { className: 'Dig_intro' }, t('none'));
      return e(
        'ul',
        { className: 'Dig_list' },
        mappings.map(([key, m]) =>
          e(
            'li',
            { key, className: 'Dig_item' },
            e('span', null, `${key} → ${m.cwd || ''} (${m.sessionId || t('none')})`),
            e(
              'button',
              {
                type: 'button',
                className: 'Dig_btn',
                onClick: async () => {
                  await api('/im-gateway/mappings/' + encodeURIComponent(key), { method: 'DELETE' });
                  load();
                },
              },
              t('unbind'),
            ),
          ),
        ),
      );
    }

    function droppedList(t, dropped) {
      if (!dropped.length) return e('p', { className: 'Dig_intro' }, t('none'));
      return e(
        'ul',
        { className: 'Dig_list' },
        dropped.map((row) => e('li', { key: row.userId, className: 'Dig_item' }, row.userId)),
      );
    }

    function WeixinDetail({ t, status, allowText, setAllowText, load }) {
      const qr = status && status.qr;
      const weixin = mergePlatforms(status).find((p) => p.id === 'weixin') || {};
      const mappings = Object.entries((status && status.mappings) || {}).filter(([key]) => key.startsWith('weixin:'));
      const dropped = ((status && status.recentDropped) || []).filter((row) => !row.platform || row.platform === 'weixin');
      return e(
        React.Fragment,
        null,
        e('p', { className: 'Dig_intro' }, t('weixinDetailHint')),
        weixin.botId ? e('p', { className: 'Dig_meta' }, weixin.botId) : null,
        qr && qr.payload
          ? e(
              'div',
              { className: 'Dig_row' },
              e('img', { className: 'Dig_qr', alt: 'qr', src: qrSrc(qr) }),
              e('p', { className: 'Dig_intro' }, t('qrHint')),
              e('pre', { className: 'Dig_pre' }, qr.payload),
            )
          : null,
        e(
          'div',
          { className: 'Dig_actions' },
          e(
            'button',
            {
              type: 'button',
              className: 'Dig_btn',
              onClick: async () => {
                await api('/im-gateway/login', { method: 'POST' });
                load();
              },
            },
            t('scan'),
          ),
          e('button', { type: 'button', className: 'Dig_btn', onClick: load }, t('refresh')),
          e(
            'button',
            {
              type: 'button',
              className: 'Dig_btn',
              onClick: async () => {
                await api('/im-gateway/logout', { method: 'POST' });
                load();
              },
            },
            t('logout'),
          ),
        ),
        e(
          'div',
          { className: 'Dig_row' },
          e('label', { className: 'Dig_label' }, t('allowlist')),
          e('textarea', {
            className: 'Dig_ta',
            value: allowText,
            onChange: (ev) => setAllowText(ev.target.value),
          }),
          e(
            'button',
            {
              type: 'button',
              className: 'Dig_btn',
              onClick: async () => {
                await api('/im-gateway/allowlist', {
                  method: 'PUT',
                  body: JSON.stringify({ platform: 'weixin', userIds: allowText.split(/\s+/).filter(Boolean) }),
                });
                load();
              },
            },
            t('save'),
          ),
        ),
        e('div', { className: 'Dig_row' }, e('div', { className: 'Dig_label' }, t('dropped')), droppedList(t, dropped)),
        e('div', { className: 'Dig_row' }, e('div', { className: 'Dig_label' }, t('mappings')), mappingList(t, mappings, load)),
      );
    }

    function LarkDetail({ t, status, allowText, setAllowText, load }) {
      const lark = mergePlatforms(status).find((p) => p.id === 'lark') || {};
      const [appId, setAppId] = React.useState(lark.appId || '');
      const [appSecret, setAppSecret] = React.useState('');
      const [encryptKey, setEncryptKey] = React.useState('');
      const [verificationToken, setVerificationToken] = React.useState('');
      React.useEffect(() => {
        setAppId(lark.appId || '');
      }, [lark.appId]);
      const mappings = Object.entries((status && status.mappings) || {}).filter(([key]) => key.startsWith('lark:'));
      const dropped = ((status && status.recentDropped) || []).filter((row) => row.platform === 'lark');
      return e(
        React.Fragment,
        null,
        e('p', { className: 'Dig_intro' }, t('larkDetailHint')),
        lark.botId ? e('p', { className: 'Dig_meta' }, lark.botId) : null,
        lark.error ? e('p', { className: 'Dig_intro' }, `${t('larkError')}: ${lark.error}`) : null,
        field({ label: t('appId'), value: appId, onChange: setAppId }),
        field({
          label: t('appSecret'),
          value: appSecret,
          onChange: setAppSecret,
          type: 'password',
          placeholder: lark.hasSecret ? t('secretKept') : '',
        }),
        field({
          label: t('encryptKey'),
          value: encryptKey,
          onChange: setEncryptKey,
          type: 'password',
          placeholder: lark.hasEncryptKey ? t('secretKept') : '',
        }),
        field({
          label: t('verificationToken'),
          value: verificationToken,
          onChange: setVerificationToken,
          type: 'password',
          placeholder: lark.hasVerificationToken ? t('secretKept') : '',
        }),
        e(
          'div',
          { className: 'Dig_actions' },
          e(
            'button',
            {
              type: 'button',
              className: 'Dig_btn',
              onClick: async () => {
                const body = { enabled: Boolean(lark.enabled), appId };
                if (appSecret) body.appSecret = appSecret;
                if (encryptKey) body.encryptKey = encryptKey;
                if (verificationToken) body.verificationToken = verificationToken;
                await api('/im-gateway/platforms/lark', { method: 'PUT', body: JSON.stringify(body) });
                setAppSecret('');
                setEncryptKey('');
                setVerificationToken('');
                load();
              },
            },
            t('saveConfig'),
          ),
          e('button', { type: 'button', className: 'Dig_btn', onClick: load }, t('refresh')),
        ),
        e(
          'div',
          { className: 'Dig_row' },
          e('label', { className: 'Dig_label' }, t('larkAllowlist')),
          e('textarea', {
            className: 'Dig_ta',
            value: allowText,
            onChange: (ev) => setAllowText(ev.target.value),
          }),
          e(
            'button',
            {
              type: 'button',
              className: 'Dig_btn',
              onClick: async () => {
                await api('/im-gateway/allowlist', {
                  method: 'PUT',
                  body: JSON.stringify({ platform: 'lark', userIds: allowText.split(/\s+/).filter(Boolean) }),
                });
                load();
              },
            },
            t('save'),
          ),
        ),
        e('div', { className: 'Dig_row' }, e('div', { className: 'Dig_label' }, t('dropped')), droppedList(t, dropped)),
        e('div', { className: 'Dig_row' }, e('div', { className: 'Dig_label' }, t('mappings')), mappingList(t, mappings, load)),
      );
    }

    function GatewayRow({ t, platform, selected, onSelect, onToggle, onConfigure }) {
      const kind = pillKind(platform);
      return e(
        'li',
        { className: 'Dig_gw', 'data-sel': selected ? 'true' : 'false', onClick: onSelect },
        e('span', { className: 'Dig_icon', style: { background: platform.color } }, platform.mark),
        e(
          'div',
          { className: 'Dig_gwMain' },
          e(
            'div',
            { className: 'Dig_gwHead' },
            e('span', { className: 'Dig_gwName' }, t(platform.nameKey)),
            e('span', { className: 'Dig_badge', 'data-kind': kind }, pillText(t, kind)),
          ),
          e('p', { className: 'Dig_gwHint' }, t(platform.hintKey)),
          selected
            ? e(
                'div',
                { className: 'Dig_gwLinks' },
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'Dig_link',
                    onClick: (ev) => {
                      ev.stopPropagation();
                      onConfigure();
                    },
                  },
                  t('configure'),
                ),
              )
            : null,
        ),
        e(Switch, {
          on: Boolean(platform.enabled && platform.available),
          disabled: !platform.toggleable,
          onClick: (ev) => {
            ev.stopPropagation();
            if (!platform.toggleable) return;
            onToggle(!platform.enabled);
          },
        }),
      );
    }

    function SettingsSection({ t }) {
      const [status, setStatus] = React.useState(null);
      const [allowText, setAllowText] = React.useState('');
      const [error, setError] = React.useState('');
      const [selected, setSelected] = React.useState('weixin');
      const [detail, setDetail] = React.useState('');

      const load = React.useCallback(async () => {
        try {
          const s = await api('/im-gateway/status');
          setStatus(s);
          const lists = s.allowlists || {};
          if (detail === 'lark') setAllowText((lists.lark || []).join('\n'));
          else setAllowText((lists.weixin || s.allowlist || []).join('\n'));
          setError('');
        } catch (err) {
          setError(String(err.message || err));
        }
      }, [detail]);

      const weixin = mergePlatforms(status).find((p) => p.id === 'weixin') || {};
      const weixinOn = Boolean(weixin.connected);

      React.useEffect(() => {
        load();
      }, [load]);

      React.useEffect(() => {
        const id = setInterval(async () => {
          try {
            if (detail === 'weixin' && !weixinOn) await api('/im-gateway/login');
          } catch {
            /* ignore */
          }
          load();
        }, 2500);
        return () => clearInterval(id);
      }, [load, detail, weixinOn]);

      const platforms = mergePlatforms(status);
      const catalog = CATALOG.find((p) => p.id === detail);

      if (detail && catalog) {
        return e(
          'div',
          { className: 'Dig_section' },
          e(
            'div',
            { className: 'Dig_actions' },
            e(
              'button',
              { type: 'button', className: 'Dig_btn', onClick: () => setDetail('') },
              t('back'),
            ),
          ),
          e('h2', { className: 'Dig_title' }, t(catalog.nameKey)),
          error ? e('p', { className: 'Dig_intro' }, error) : null,
          detail === 'weixin'
            ? e(WeixinDetail, { t, status, allowText, setAllowText, load })
            : e(LarkDetail, { t, status, allowText, setAllowText, load }),
        );
      }

      return e(
        'div',
        { className: 'Dig_section' },
        e('h2', { className: 'Dig_title' }, t('title')),
        e('p', { className: 'Dig_intro' }, t('intro')),
        error ? e('p', { className: 'Dig_intro' }, error) : null,
        e(
          'ul',
          { className: 'Dig_gws' },
          platforms.map((p) =>
            e(GatewayRow, {
              key: p.id,
              t,
              platform: p,
              selected: selected === p.id,
              onSelect: () => setSelected(p.id),
              onConfigure: () => setDetail(p.id),
              onToggle: async (enabled) => {
                try {
                  const s = await api('/im-gateway/platforms/' + encodeURIComponent(p.id), {
                    method: 'PUT',
                    body: JSON.stringify({ enabled }),
                  });
                  setStatus(s);
                  setAllowText(((s.allowlists && s.allowlists.weixin) || s.allowlist || []).join('\n'));
                  setError('');
                } catch (err) {
                  setError(String(err.message || err));
                }
              },
            }),
          ),
        ),
      );
    }

    const inject = ['slots', 'locale'];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-im-gateway: dictionaries');
      const t = ctx.locale.bind(NS);
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'im-gateway',
            order: 26,
            label: () => t('nav'),
            locale: NS,
          },
          (props) => e(SettingsSection, Object.assign({}, props, { t })),
        ),
      );
    }

    bundleModule.exports.apply = apply;
    bundleModule.exports.inject = inject;
    return bundleModule.exports;
  },
});
