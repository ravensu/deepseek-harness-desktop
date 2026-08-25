# dsh-im-gateway 设计

日期：2026-08-24

## 目标

在 DeepSeek Harness 桌面开着（`dsh web`）时，用微信私聊驱动**完整 Agent**（工具、工作目录、审批），会话能在 Web UI 打开对照。形态为 `plugins/harness/` 纯 dsh 双面插件，内部 Adapter 接口，v1 只接微信 iLink Bot API。

## 非目标

- 独立 daemon / 关窗口仍在线
- 微信网页协议、企业微信
- v1 群聊、图片/文件/语音
- 第二个 npm 包或飞书 adapter 实现
- Hermes `[SILENT]`、流式改同一条微信消息
- 自动猜测项目目录

## 安装

- 路径：`plugins/harness/dsh-im-gateway/`
- 开发：`pnpm plugin:link`
- 不打进 Electron 安装包

## 架构

Host 跑在 `dsh web` 进程。核心禁止 import IM SDK。关窗口即停 gateway；凭证与映射在 `DSH_HOME/im-gateway/`，重启后自动续连。

```
微信 iLink 长轮询
        │
   weixin adapter
        │  InboundMessage
        ▼
   gateway core（allowlist → 命令/审批 → 路由 → agent-bridge）
        │
        ├─ ctx.agents.create/resume + followup
        ├─ session/event → 进度回写
        └─ tools/pre-execute → 微信 1/2
```

Adapter 契约：`start`/`stop`、`inbound`、`send(chatId, payload)`、`capabilities: { buttons, editMessage, groups }`（微信全 false）。

Cordis：`inject: ['agents']`，可选 `sessions`、`webServer`、`tools`。`cordis.patch.yml` 插入 `id: im-gateway`。

## 会话映射

主键 `weixin:<userId>` → `{ sessionId, cwd, displayName, yolo, updatedAt }`。

进线：不在允许名单静默丢弃（store 记 recentDropped 供设置页复制）；斜杠命令不进模型；无 cwd 或目录不存在则拦住并提示 `/cwd`；否则 resume，失败则 create，再 `followup`。忙碌时普通消息仍 followup。审批等待态普通文本不进模型。

`/cwd <绝对路径>`：必须存在的目录；成功则**新开会话**，旧 session 留在桌面。`/new` 同目录新会话。Gateway session 的 `meta.source = 'im-gateway'`、`meta.imKey`。

## 命令、审批、回写

`/help` `/cwd` `/new` `/status` `/cancel` `/yolo on|off` `/approve` `/deny`；未知命令只回 help。

默认 ask。`/yolo on` 只自动放行本会是 ask 的工具，deny 策略仍拒绝。审批：一条私聊同时只挂一条；5 分钟超时 = deny。回写：不报「收到」、不推 token；首次 tool/call 一条开工；其后 15 秒最多再更一条；idle 后发最终文本（按 2000 字分段）；无正文则「本轮完成，无文字回复」。

## 设置页

设置分区「IM 网关」：连接状态、扫码登录（展示 iLink 二维码内容）、退出登录、允许名单（每行一个 userId）、映射表（解绑）、最近被忽略的 userId。凭证不进浏览器 localStorage。Host 提供 `/im-gateway/*` HTTP（若有 `webServer`）。

## 失败

iLink 普通错误退避重试；`ret=-14` 清凭证停轮询，设置页显示需重新扫码。出站失败排队；连续失败不在微信死循环刷错。Host API 缺失时插件 warn 并降级，不拖垮 `dsh web`。

## 测试

node:test：allowlist、路由、命令、审批状态机、进度节流与分段、pipeline、weixin 请求体/入站归一化。不打真实 iLink。
