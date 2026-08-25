# Feishu IM Gateway Implementation Plan

> **For agentic workers:** Use inline execution in this session. Do not commit unless the user asks. REQUIRED: TDD — failing test before production code.

**Goal:** Drive the same local DSH agent from Feishu DMs over the official WebSocket long connection, inside `dsh-im-gateway`.

**Architecture:** Add `adapters/lark.js`. Pipeline stays platform-agnostic. `send` routes on `chatKey` prefix `lark:`. Store grows per-platform allowlists and `channels.lark` credentials. Settings list enables Feishu; the detail page holds App ID / Secret / Encrypt Key / Verification Token.

**Tech Stack:** ESM Cordis plugin, `@larksuiteoapi/node-sdk` (`WSClient` + `Client` + `EventDispatcher`), node:test. SDK is injectable so tests never hit Feishu.

## Global Constraints

- Package: `plugins/harness/dsh-im-gateway/`
- DMs only; drop group events
- Allowlist fail-closed per platform
- HTTP status never returns `appSecret` / `encryptKey` / `verificationToken`
- Do not commit unless asked

## Files

- Create: `lib/adapters/lark.js`, `test/lark.test.js`
- Modify: `lib/store.js`, `lib/pipeline.js`, `lib/http.js`, `lib/index.js`, `lib/client.js`, `package.json`, `test/store.test.js`, `test/weixin.test.js`, `test/pipeline.test.js`

---

### Task 1: Per-platform allowlists and Lark credentials in store

**Files:** `lib/store.js`, `test/store.test.js`

- [ ] **Step 1: Write failing tests** in `test/store.test.js`

```js
test('lark allowlist is separate from weixin and old allowlist migrates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    version: 1, allowlist: ['wx-user'], mappings: {}, recentDropped: [], credentials: null,
    cursor: { getUpdatesBuf: '' }, contextTokens: {},
  }));
  const s = createStore(dir);
  s.load();
  assert.equal(s.isAllowed('wx-user'), true);
  assert.equal(s.isAllowed('wx-user', 'weixin'), true);
  assert.equal(s.isAllowed('wx-user', 'lark'), false);
  s.setAllowlist(['ou_1'], 'lark');
  assert.equal(s.isAllowed('ou_1', 'lark'), true);
  assert.equal(s.isAllowed('ou_1', 'weixin'), false);
});

test('lark credentials persist without mixing into weixin credentials', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-gw-'));
  const s = createStore(dir);
  s.load();
  s.setLarkConfig({ appId: 'cli_a', appSecret: 'sec', encryptKey: 'ek', verificationToken: 'vt' });
  const b = createStore(dir);
  b.load();
  assert.equal(b.data.channels.lark.appId, 'cli_a');
  assert.equal(b.data.channels.lark.appSecret, 'sec');
});
```

- [ ] **Step 2:** `node --test plugins/harness/dsh-im-gateway/test/store.test.js` — fail (`setLarkConfig` missing)
- [ ] **Step 3:** Implement `allowlists`, migrate old `allowlist` → `allowlists.weixin`, `isAllowed(userId, platform='weixin')`, `setAllowlist(ids, platform='weixin')` keeping `data.allowlist` in sync for weixin, `setLarkConfig(patch)` merging into `channels.lark`
- [ ] **Step 4:** Re-run store tests — pass
- [ ] **Step 5:** Do not commit

### Task 2: Pipeline uses platform allowlist

**Files:** `lib/pipeline.js`, `test/pipeline.test.js`

- [ ] Failing test: Lark inbound for `ou_1` is dropped unless `setAllowlist(['ou_1'], 'lark')`; weixin allowlist must not admit them
- [ ] `handleInbound` calls `store.isAllowed(userId, inbound.platform || 'weixin')`
- [ ] `rememberDropped(userId, inbound.platform)`
- [ ] Do not commit

### Task 3: Lark inbound normalize + send (injected SDK)

**Files:** `lib/adapters/lark.js`, `test/lark.test.js`

`normalizeInbound(event, botOpenId)`:

- p2p text → `{ platform:'lark', userId, chatId, chatKey:'lark:<openId>', text }`
- group / bot / app sender / empty / non-text-or-post → `null`
- `text` content JSON `{text}`; `post` walks `content[][].text`

`createLarkAdapter({ store, log, onMessage, Lark })`:

- `start` / `stop` / `sendText` / `isConnected` / `getError`
- `capabilities: { buttons:false, editMessage:false, groups:false }`
- Tests inject fake `WSClient`, `Client`, `EventDispatcher`

- [ ] Do not commit

### Task 4: HTTP — Feishu available, config PUT, masked status, allowlist platform

**Files:** `lib/http.js`, `test/lark.test.js`, `test/weixin.test.js`

- `listPlatforms` lark `available: true`
- PUT `/im-gateway/platforms/lark` `{ enabled, appId, appSecret, encryptKey, verificationToken }`
- status lark: `appId`, `hasSecret`, `hasEncryptKey`, `hasVerificationToken`, `botId`, `connected`, `error` — never secret plaintext
- PUT allowlist `{ userIds, platform }` default weixin
- snapshot includes `allowlists`
- Existing weixin test: change `lark.available` to `true`
- Do not commit

### Task 5: Host wiring

**Files:** `lib/index.js`, `package.json`

- `pnpm add @larksuiteoapi/node-sdk --filter dsh-im-gateway`
- `send`: `lark:` prefix → `lark.sendText`, else weixin
- Toggle start/stop both adapters
- `dispose` stops both
- Do not commit

### Task 6: Settings UI

**Files:** `lib/client.js`

- Lark toggleable
- Detail: credential fields, save, per-platform allowlist / mappings / dropped
- Copy: DMs now, groups later
- Do not commit
