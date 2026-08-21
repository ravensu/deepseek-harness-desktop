window.__ModuleLoader__.load({
  id: 'dsh-cost-meter',
  factory: (require) => {
    const bundleModule = { exports: {} };
    Object.defineProperty(bundleModule.exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    const e = React.createElement;

    const css = `
.Dcm_line{text-align:center;box-sizing:border-box;width:100%;max-width:none;padding:4px 8px 2px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;margin:0;font-size:12px;line-height:20px;display:block;overflow:hidden;font-variant-numeric:tabular-nums}
.Dcm_sep{color:var(--dsw-alias-separator-primary);margin:0 10px}
.Dcm_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}
.Dcm_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}
.Dcm_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}
.Dcm_list{margin:0;padding:0;list-style:none;flex-direction:column;gap:6px;display:flex}
.Dcm_row{align-items:center;gap:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;display:flex;background:transparent}
.Dcm_row[data-dragging=true]{opacity:.55}
.Dcm_row[data-over=true]{border-color:var(--dsw-alias-state-business-primary)}
.Dcm_grip{cursor:grab;color:var(--dsw-alias-label-tertiary);width:20px;height:28px;flex:none;place-items:center;display:grid;user-select:none}
.Dcm_grip:active{cursor:grabbing}
.Dcm_check{margin:0;flex:none}
.Dcm_rowLabel{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px;flex:1}
.Dcm_actions{display:flex;gap:8px}
.Dcm_btn{box-sizing:border-box;font:inherit;font-size:13px;line-height:20px;cursor:pointer;border-radius:8px;padding:5px 12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1, transparent);color:var(--dsw-alias-label-primary)}
.Dcm_btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
`;
    const cssTagId = 'dsh-cost-meter/ui.css';
    if (typeof document !== 'undefined') {
      let tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(cssTagId) + ']');
      if (!tag) {
        tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-cost-meter';
        tag.dataset.pluginCss = cssTagId;
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    }

    const NS = 'cost-meter';
    const LAYOUT_KEY = 'dsh-cost-meter.layout.v1';
    const LAYOUT_EVENT = 'dsh-cost-meter-layout';
    const METRIC_IDS = [
      'counts',
      'llm',
      'toolCall',
      'ttft',
      'tps',
      'cacheHit',
      'tokens',
      'turnCost',
      'sessionCost',
    ];

    const zh = {
      nav: '统计栏',
      title: '统计栏',
      intro: '勾选要显示的项，按住左侧手柄拖动调整顺序。还没有数据的项会自动隐藏。',
      reset: '恢复默认',
      drag: '拖动排序',
      counts: '{turns} 轮 · {steps} 步',
      llm: 'LLM {duration}',
      toolCall: '工具调用 {duration}',
      ttft: '首 token 平均 {duration}',
      tps: '{throughput} tok/s',
      cacheHit: '缓存命中 {percent}%',
      tokens: '输入 {input} tok · 输出 {output} tok',
      turn: '本轮 {cost}',
      session: '会话 {cost}',
      labelCounts: '轮次 / 步数',
      labelLlm: 'LLM 耗时',
      labelToolCall: '工具调用耗时',
      labelTtft: '首 token 平均',
      labelTps: '生成速度',
      labelCacheHit: '缓存命中',
      labelTokens: '输入 / 输出 token',
      labelTurnCost: '本轮费用',
      labelSessionCost: '会话费用',
      estimate: '估算，以 DeepSeek 控制台为准',
      noPrice: '无官方价',
      input: '未命中输入',
      cacheRead: '缓存命中',
      output: '输出',
      model: '模型',
      peak: '高峰价',
      offpeak: '空闲价',
    };
    const en = {
      nav: 'Stats bar',
      title: 'Stats bar',
      intro: 'Toggle items and drag the handle to reorder. Empty values stay hidden.',
      reset: 'Reset defaults',
      drag: 'Drag to reorder',
      counts: '{turns} turns · {steps} steps',
      llm: 'LLM {duration}',
      toolCall: 'Tools {duration}',
      ttft: 'TTFT avg {duration}',
      tps: '{throughput} tok/s',
      cacheHit: 'Cache hit {percent}%',
      tokens: 'In {input} tok · Out {output} tok',
      turn: 'Turn {cost}',
      session: 'Session {cost}',
      labelCounts: 'Turns / steps',
      labelLlm: 'LLM time',
      labelToolCall: 'Tool time',
      labelTtft: 'Average TTFT',
      labelTps: 'Throughput',
      labelCacheHit: 'Cache hit',
      labelTokens: 'Input / output tokens',
      labelTurnCost: 'Turn cost',
      labelSessionCost: 'Session cost',
      estimate: 'Estimate; DeepSeek console is authoritative',
      noPrice: 'No official rate',
      input: 'Cache miss input',
      cacheRead: 'Cache hit',
      output: 'Output',
      model: 'Model',
      peak: 'Peak',
      offpeak: 'Off-peak',
    };

    const LABEL_KEY = {
      counts: 'labelCounts',
      llm: 'labelLlm',
      toolCall: 'labelToolCall',
      ttft: 'labelTtft',
      tps: 'labelTps',
      cacheHit: 'labelCacheHit',
      tokens: 'labelTokens',
      turnCost: 'labelTurnCost',
      sessionCost: 'labelSessionCost',
    };

    function defaultItems() {
      return METRIC_IDS.map((id) => ({ id, enabled: true }));
    }

    function normalizeLayout(raw) {
      const seen = new Set();
      const items = [];
      const src = Array.isArray(raw && raw.items) ? raw.items : [];
      for (const row of src) {
        if (!row || typeof row.id !== 'string') continue;
        if (METRIC_IDS.indexOf(row.id) < 0 || seen.has(row.id)) continue;
        seen.add(row.id);
        items.push({ id: row.id, enabled: row.enabled !== false });
      }
      for (const id of METRIC_IDS) {
        if (!seen.has(id)) items.push({ id, enabled: true });
      }
      return items;
    }

    function moveItem(items, from, to) {
      if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
        return items.slice();
      }
      const next = items.slice();
      const row = next.splice(from, 1)[0];
      next.splice(to, 0, row);
      return next;
    }

    function pickGroups(items, values) {
      const groups = [];
      for (const row of items) {
        if (!row.enabled) continue;
        const text = values[row.id];
        if (typeof text === 'string' && text.length > 0) groups.push(text);
      }
      return groups;
    }

    function loadLayout() {
      try {
        const raw = localStorage.getItem(LAYOUT_KEY);
        return normalizeLayout(raw ? JSON.parse(raw) : null);
      } catch {
        return defaultItems();
      }
    }

    function saveLayout(items) {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ items: normalizeLayout({ items }) }));
      window.dispatchEvent(new Event(LAYOUT_EVENT));
    }

    function useLayoutItems() {
      const [items, setItems] = React.useState(loadLayout);
      React.useEffect(() => {
        const refresh = (ev) => {
          if (ev && ev.type === 'storage' && ev.key && ev.key !== LAYOUT_KEY) return;
          setItems(loadLayout());
        };
        window.addEventListener('storage', refresh);
        window.addEventListener(LAYOUT_EVENT, refresh);
        return () => {
          window.removeEventListener('storage', refresh);
          window.removeEventListener(LAYOUT_EVENT, refresh);
        };
      }, []);
      const update = (next) => {
        const normalized = normalizeLayout({ items: next });
        saveLayout(normalized);
        setItems(normalized);
      };
      return [items, update];
    }

    function fmt(template, vars) {
      return String(template).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
    }

    function formatTokens(n) {
      const v = Number(n) || 0;
      const scaled = (x) => (x >= 100 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));
      if (v < 1e3) return String(Math.round(v));
      if (v < 1e6) return scaled(v / 1e3) + 'K';
      return scaled(v / 1e6) + 'M';
    }

    function formatDuration(ms) {
      const s = ms / 1e3;
      if (s < 60) return String(Math.round(s * 10) / 10) + 's';
      const whole = Math.round(s);
      return Math.floor(whole / 60) + 'm' + (whole % 60) + 's';
    }

    function formatTps(tps) {
      const clamped = Math.max(0, tps);
      return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10);
    }

    function billedInputTokens(usage) {
      if (!usage) return 0;
      return (
        (Number(usage.uncachedInputTokens) || 0) +
        (Number(usage.cacheReadTokens) || 0) +
        (Number(usage.cacheWriteTokens) || 0)
      );
    }

    function cacheHitPercent(usage) {
      const denom = billedInputTokens(usage);
      if (denom <= 0) return null;
      const hit = Number(usage.cacheReadTokens) || 0;
      if (hit <= 0) return '0';
      if (hit >= denom) return '100';
      return String(Math.round((hit / denom) * 100));
    }

    function tokenCount(tokens) {
      if (!tokens) return 0;
      return (
        (Number(tokens.inputTokens) || 0) +
        (Number(tokens.cacheReadTokens) || 0) +
        (Number(tokens.cacheWriteTokens) || 0) +
        (Number(tokens.outputTokens) || 0)
      );
    }

    function formatCny(value, priced, hasUsage) {
      if (!hasUsage) return '-';
      if (!priced) return '—';
      if (!Number.isFinite(value)) return '—';
      if (value === 0) return '¥0.00';
      const abs = Math.abs(value);
      if (abs >= 1) return '¥' + value.toFixed(2);
      if (abs >= 0.01) return '¥' + value.toFixed(3);
      return '¥' + value.toFixed(4);
    }

    function costTooltip(meter, t) {
      if (!meter) return t('estimate');
      const session = meter.sessionTokens || {};
      const costs = meter.sessionCosts || {};
      const lines = [t('estimate')];
      if (!meter.priced) lines.push(t('noPrice'));
      const money = (n) => (meter.priced ? ' · ' + formatCny(n, true, true) : '');
      lines.push(t('input') + ': ' + formatTokens(session.inputTokens) + money(costs.inputCost));
      lines.push(t('cacheRead') + ': ' + formatTokens(session.cacheReadTokens) + money(costs.cacheReadCost));
      lines.push(t('output') + ': ' + formatTokens(session.outputTokens) + money(costs.outputCost));
      if (meter.model) lines.push(t('model') + ': ' + meter.model);
      if (meter.tier === 'peak') lines.push(t('peak'));
      if (meter.tier === 'offpeak') lines.push(t('offpeak'));
      return lines.join('\n');
    }

    function isOfficialStatsLine(el) {
      if (!el || el.dataset.costMeter) return false;
      const cs = window.getComputedStyle(el);
      return cs.whiteSpace === 'nowrap' && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis');
    }

    function metricValues(t, stats, usage, meter) {
      const hasUsage = tokenCount(meter && meter.sessionTokens) > 0;
      const priced = !!(meter && meter.priced);
      const cacheHit = usage ? cacheHitPercent(usage) : null;
      const hasTokens = usage && (billedInputTokens(usage) > 0 || (usage.outputTokens || 0) > 0);
      return {
        counts: stats && stats.steps > 0 ? fmt(t('counts'), { turns: stats.turns, steps: stats.steps }) : '',
        llm: stats && stats.llmMs > 0 ? fmt(t('llm'), { duration: formatDuration(stats.llmMs) }) : '',
        toolCall: stats && stats.toolMs > 0 ? fmt(t('toolCall'), { duration: formatDuration(stats.toolMs) }) : '',
        ttft:
          stats && stats.ttftSteps > 0
            ? fmt(t('ttft'), { duration: formatDuration(stats.ttftMs / stats.ttftSteps) })
            : '',
        tps:
          stats && stats.decodeMs > 0
            ? fmt(t('tps'), { throughput: formatTps(stats.decodeTokens / (stats.decodeMs / 1e3)) })
            : '',
        cacheHit: cacheHit !== null ? fmt(t('cacheHit'), { percent: cacheHit }) : '',
        tokens: hasTokens
          ? fmt(t('tokens'), {
              input: formatTokens(billedInputTokens(usage)),
              output: formatTokens(usage.outputTokens || 0),
            })
          : '',
        turnCost: hasUsage ? fmt(t('turn'), { cost: formatCny(meter.turnCostCny, priced, true) }) : '',
        sessionCost: hasUsage ? fmt(t('session'), { cost: formatCny(meter.sessionCostCny, priced, true) }) : '',
      };
    }

    function CombinedLine(props) {
      const t = props.t || ((k) => k);
      const useProjection = props.useProjection;
      const stats = useProjection ? useProjection('sessionStats') : undefined;
      const usage = useProjection ? useProjection('tokenUsage') : undefined;
      const meter = useProjection ? useProjection('costMeter') : undefined;
      const [items] = useLayoutItems();
      const lineRef = React.useRef(null);

      React.useLayoutEffect(() => {
        const self = lineRef.current;
        if (!self || !self.parentElement) return;
        const hidden = [];
        for (const child of self.parentElement.children) {
          if (child === self) continue;
          if (!isOfficialStatsLine(child)) continue;
          child.style.display = 'none';
          hidden.push(child);
        }
        return () => {
          for (const child of hidden) child.style.display = '';
        };
      });

      const groups = pickGroups(items, metricValues(t, stats, usage, meter));
      if (!groups.length) return e('span', { ref: lineRef, 'data-cost-meter': true, style: { display: 'none' } });

      const title = [groups.join(' | '), costTooltip(meter, t)].join('\n');
      return e(
        'div',
        { ref: lineRef, className: 'Dcm_line', 'data-cost-meter': true, title },
        groups.map((group, i) =>
          e(
            React.Fragment,
            { key: group + i },
            i > 0 ? e('span', { className: 'Dcm_sep', 'aria-hidden': true }, '|') : null,
            i > 0 ? ' ' : null,
            e('span', null, group),
          ),
        ),
      );
    }

    function SettingsSection(props) {
      const t = props.t || ((k) => k);
      const [items, update] = useLayoutItems();
      const dragFrom = React.useRef(null);
      const [over, setOver] = React.useState(-1);
      const [dragging, setDragging] = React.useState(-1);

      const onDrop = (to) => {
        const from = dragFrom.current;
        dragFrom.current = null;
        setOver(-1);
        setDragging(-1);
        if (typeof from !== 'number') return;
        update(moveItem(items, from, to));
      };

      return e('div', { className: 'Dcm_section' },
        e('h2', { className: 'Dcm_title' }, t('title')),
        e('p', { className: 'Dcm_intro' }, t('intro')),
        e(
          'ul',
          { className: 'Dcm_list' },
          items.map((row, index) =>
            e(
              'li',
              {
                key: row.id,
                className: 'Dcm_row',
                'data-dragging': dragging === index ? 'true' : 'false',
                'data-over': over === index && dragging !== index ? 'true' : 'false',
                draggable: true,
                onDragStart: (ev) => {
                  dragFrom.current = index;
                  setDragging(index);
                  ev.dataTransfer.effectAllowed = 'move';
                  try {
                    ev.dataTransfer.setData('text/plain', row.id);
                  } catch {
                    /* ignore */
                  }
                },
                onDragEnd: () => {
                  dragFrom.current = null;
                  setOver(-1);
                  setDragging(-1);
                },
                onDragOver: (ev) => {
                  ev.preventDefault();
                  ev.dataTransfer.dropEffect = 'move';
                  setOver(index);
                },
                onDrop: (ev) => {
                  ev.preventDefault();
                  onDrop(index);
                },
              },
              e('span', { className: 'Dcm_grip', title: t('drag'), 'aria-label': t('drag') }, '⋮⋮'),
              e('input', {
                className: 'Dcm_check',
                type: 'checkbox',
                checked: row.enabled,
                onChange: (ev) => {
                  const next = items.slice();
                  next[index] = { id: row.id, enabled: ev.target.checked };
                  update(next);
                },
              }),
              e('span', { className: 'Dcm_rowLabel' }, t(LABEL_KEY[row.id])),
            ),
          ),
        ),
        e(
          'div',
          { className: 'Dcm_actions' },
          e(
            'button',
            {
              type: 'button',
              className: 'Dcm_btn',
              onClick: () => update(defaultItems()),
            },
            t('reset'),
          ),
        ),
      );
    }

    const inject = ['slots', 'locale'];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-cost-meter: dictionaries');
      const t = ctx.locale.bind(NS);
      ctx.slots.inject('conversation.composer.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: 'dsh-cost-meter',
            order: 10,
            locale: NS,
          },
          (props) => e(CombinedLine, Object.assign({}, props, { t })),
        ),
      );
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'cost-meter',
            order: 24,
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
