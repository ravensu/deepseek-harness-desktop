# dsh-im-gateway Implementation Plan

> **For agentic workers:** Use inline execution in this session. Do not commit unless the user asks.

**Goal:** Ship a harness plugin that drives full DSH agents from WeChat DMs via iLink, with per-chat cwd mapping and text approvals.

**Architecture:** Single package, Adapter seam, core never imports iLink URLs. Persist under `DSH_HOME/im-gateway/`. Settings page talks to host HTTP.

**Tech Stack:** ESM Cordis plugin, node:test, Node 22 fetch.

## Global Constraints

- Package: `plugins/harness/dsh-im-gateway/`
- No Electron / `window.dshDesktop`
- WeChat DM + text only
- Allowlist fail-closed
- Do not commit unless asked

---

### Task 1: Store, router, commands, approvals, progress (TDD)

**Files:** `lib/store.js` `lib/router.js` `lib/commands.js` `lib/approvals.js` `lib/progress.js` `lib/split.js` + tests

### Task 2: Pipeline + agent-bridge

**Files:** `lib/pipeline.js` `lib/agent-bridge.js` + tests

### Task 3: Weixin adapter (injectable fetch)

**Files:** `lib/adapters/weixin.js` + tests

### Task 4: Host plugin, HTTP, settings client

**Files:** `package.json` `cordis.patch.yml` `lib/index.js` `lib/http.js` `lib/client.js`

### Task 5: Wire test glob + README
