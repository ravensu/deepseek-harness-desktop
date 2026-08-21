# dsh-cost-meter Implementation Plan

> **For agentic workers:** Use inline execution in this session. USD display is out of v1 scope.

**Goal:** Ship a pure harness plugin that shows CNY turn/session cost and cache hit rates on a conversation bottom bar.

**Architecture:** Host folds session usage events with official DeepSeek CNY peak/off-peak rates into `costMeter`. Client portals a status bar to the viewport bottom.

**Tech Stack:** ESM Cordis plugin, `sessionProjections`, web client slots, node:test.

## Global Constraints

- Package lives in `plugins/harness/dsh-cost-meter/`; not bundled into Electron.
- Display currency is CNY only; no USD toggle, no FX.
- No `electron` / `window.dshDesktop`.
- Official rates snapshot as of 2026-08-17; peak = Beijing [09:00,12:00) ∪ [14:00,18:00).
- Do not commit unless the user asks.

---

### Task 1: Pricing + fold (TDD)

**Files:**
- Create: `plugins/harness/dsh-cost-meter/lib/pricing.js`
- Create: `plugins/harness/dsh-cost-meter/lib/fold.js`
- Create: `plugins/harness/dsh-cost-meter/test/pricing.test.js`
- Create: `plugins/harness/dsh-cost-meter/test/fold.test.js`
- Modify: `package.json` test script

- [ ] Failing tests for `isPeakBeijing`, Flash offpeak/peak math, unknown model
- [ ] Implement `pricing.js`
- [ ] Failing tests for stream last-wins, turn reset, cache rates
- [ ] Implement `fold.js`
- [ ] `pnpm test` green

### Task 2: Host projection + client bar

**Files:**
- Create: `plugins/harness/dsh-cost-meter/package.json`
- Create: `plugins/harness/dsh-cost-meter/cordis.patch.yml`
- Create: `plugins/harness/dsh-cost-meter/lib/index.js`
- Create: `plugins/harness/dsh-cost-meter/lib/client.js`
- Modify: `plugins/harness/README.md` (one-line pointer)

- [ ] Register `costMeter` via `sessionProjections`
- [ ] Bottom bar: 本轮 / 会话 / 缓存 / avg, CNY formatting, tooltip
- [ ] Unknown model shows `—` for money
