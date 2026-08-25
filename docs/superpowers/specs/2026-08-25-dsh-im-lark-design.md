# dsh-im-gateway 飞书私聊

日期：2026-08-25

## 目标

在现有 `dsh-im-gateway` 里接飞书：**桌面开着时**，用飞书机器人**私聊**驱动同一个本机 Agent（`/cwd`、工具、文本审批 1/2）。事件走飞书官方 **WebSocket 长连接**，不需要公网 webhook。

## 非目标

- 群聊、`@` 唤醒、卡片按钮审批（下一期）
- 独立插件或抽出 `im-core`
- 图片 / 文件 / 语音 / 富文本进模型（只抽纯文本）
- 用 `lark-cli` 用户身份代替应用机器人
- 钉钉、企业微信

## 产品

- 微信行为不变。
- 飞书只处理 `chat_type === 'p2p'` 的文本；群消息丢弃。
- 会话主键 `lark:<openId>`，每人一条，和微信一样走允许名单 fail-closed。
- 审批仍是私聊回复 `1` / `2` 或 `/approve` `/deny`。
- 关窗口即停长连接；凭证留在 `DSH_HOME/im-gateway/state.json`。

## 架构

同一插件，新增 `lib/adapters/lark.js`。核心 pipeline / agent-bridge 不 import 飞书 SDK。

```
飞书 WS 长连接
        │
   lark adapter  →  InboundMessage { platform:'lark', userId:openId, chatKey, text }
        ▼
   gateway core（按平台允许名单 → 命令/审批 → agent-bridge）
        │
        └─ send：chatKey 前缀 `lark:` 走飞书发消息，否则走微信
```

Adapter 契约与微信相同：`start` / `stop` / `sendText` / `capabilities: { buttons:false, editMessage:false, groups:false }`。

依赖：`@larksuiteoapi/node-sdk` 的 `WSClient` + `Client`。测试注入假 Client，不打真实飞书。

## 凭证与 store

`channels.lark`：

```
{
  enabled: false,
  appId: '',
  appSecret: '',
  encryptKey: '',
  verificationToken: '',
  botOpenId: null
}
```

- App ID / App Secret 必填才能连。
- Encrypt Key、Verification Token 选填；有 Encrypt Key 时传给 `EventDispatcher`。长连接推送一般是明文，Verification Token 本期存着，WS 建连用不到。
- 兼容旧数据：现有 `allowlist` / `credentials` 仍是微信。新增 `allowlists.weixin` / `allowlists.lark`；加载时若没有 `allowlists.weixin`，把旧 `allowlist` 迁过去。
- `isAllowed(userId, platform)`：微信继续「扫码账号永远允许」；飞书只看 `allowlists.lark`。
- `state.json` 权限 0600。HTTP status **不回** `appSecret` / `encryptKey` / `verificationToken` 明文，只回 `hasSecret`、`hasEncryptKey`、`hasVerificationToken`、`appId`。

## 设置页

网关列表里飞书变为可开关（不再「即将接入」）。二级页：

- App ID、App Secret、Encrypt Key、Verification Token
- 保存后若已启用则重连
- 状态：已连接 / 未登录（缺凭证）/ 未启用
- 飞书允许名单（每行一个 `open_id`）
- 只列出 `lark:` 映射；最近忽略按飞书 userId

用户在飞书开放平台需要：自建应用、启用机器人、事件订阅选 **长连接**、订阅 `im.message.receive_v1`、开通发消息 / 读消息权限、把应用可用性开给自己。

## 进线 / 出站

`normalizeInbound(event)`：

- 非 `im.message.receive_v1` 或 `chat_type !== 'p2p'` → `null`
- `sender_type === 'bot'` 或 open_id 等于 `botOpenId` → `null`
- `message_type` 为 `text` / `post` 时抽出纯文本；其它类型忽略
- 返回 `{ platform:'lark', userId: openId, chatId, chatKey: 'lark:<openId>', text }`

出站：`im.v1.message.create`，`receive_id_type=open_id`，`msg_type=text`。失败记日志，不在飞书里死循环刷错。

开关：`enabled=false` 或缺少 App ID/Secret → `stop()`，不清凭证。`enabled=true` 且有凭证 → `start()`。

## 失败

- 凭证错误：status 未连接 + 设置页错误文案，不拖垮 `dsh web`
- WS 断开：SDK 重连；插件侧 start 失败 warn
- Host API 缺失：与微信相同，降级

## 测试

`test/lark.test.js`：normalize（私聊通过、群聊丢、机器人丢、text/post 抽字）；保存凭证后 status 含 `available:true` 且不泄漏 secret；PUT allowlist 带 `platform:'lark'`；toggle 调用 start/stop。不连真实飞书。
