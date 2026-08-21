# dsh-cost-meter 设计

日期：2026-08-21

## 目标

在 DeepSeek Harness Web UI 对话页底部常驻显示 **本轮费用、会话累计、缓存命中率**，费用按 DeepSeek 官方人民币峰谷价估算。形态参考 Reasonix 底栏，实现为本仓库的纯 harness 插件。

**v1 不做美元切换。** 金额只显示人民币；币种切换以后再单独讨论。

## 非目标

- 不打进 Electron 安装包，不走 `plugins/desktop/`
- 不依赖 `window.dshDesktop` / Electron
- 不显示账户余额、不提供设置页改价、不设预算上限、不汇总跨会话历史
- 不把子 Agent 费用并进父会话
- 不抓取官方价格页（价表内置快照）
- v1 不切换 USD、不使用实时汇率

## 安装

- 路径：`plugins/harness/dsh-cost-meter/`
- 开发：`pnpm plugin:link` 链到当前 `DSH_HOME` 的 web profile
- 以后可独立 `dsh plugin add`

## 架构

Host 折叠会话 log 的真实 usage，按每条样本的 `time`（Unix ms）用北京时间套高峰/空闲价，写成会话投影 `costMeter`。Client 只读投影，用固定底栏渲染人民币金额。

| 模块 | 职责 | 依赖 |
|---|---|---|
| `lib/pricing.js` | 官方 CNY 价表、高峰判定、分桶计价 | 无 |
| `lib/fold.js` | 把 session event 折成计量状态 | `pricing` |
| `lib/index.js` | 注册 `costMeter` 投影 | `sessionProjections` |
| `lib/client.js` | 底栏 UI | `costMeter`、slots、locale |

## UI

对话页最底部单行全宽（`conversation.input.dock` 挂载，portal 到视口底部，dock 内留等高占位以免挡住输入框）：

- **本轮** — 当前 `turn` 的估算费用（含该 turn 内所有 step；流式中随 usage 更新）
- **会话** — 本会话累计估算费用
- **缓存** — 本轮 prompt 缓存命中率
- **avg** — 会话累计命中率：Σ cacheRead / Σ(cacheRead + input)

无数据时显示 `-`。未知模型时 token/缓存率照常，金额显示 `—`。

悬停 tooltip：未命中输入 / 缓存命中 / 输出的 token 与费用、模型、当前样本时段（高峰价/空闲价）、以及「估算，以 DeepSeek 控制台为准」。

## 计价

单位：人民币 / 百万 tokens。快照来源：[DeepSeek 模型与价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)（2026-08-17 起峰谷价）。

高峰：北京时间 **[09:00, 12:00)** 与 **[14:00, 18:00)**，其余空闲。用 `event.time` 判定，不用「现在」。

| 模型 | 档 | 缓存命中 | 缓存未命中 | 输出 |
|---|---|---|---|---|
| deepseek-v4-flash（含 flash-vision-exp） | 空闲 | 0.05 | 1.5 | 4.5 |
| | 高峰 | 0.10 | 3.0 | 9.0 |
| deepseek-v4-pro | 空闲 | 0.15 | 4.5 | 13.5 |
| | 高峰 | 0.30 | 9.0 | 27.0 |

识别：id 含 `v4-pro` → Pro；含 `v4-flash` → Flash。其它 id → 无价，`priced=false`。

```
费用 = 未命中输入 × 未命中价 + 缓存命中 × 命中价 + 输出 × 输出价
```

`cacheWriteTokens` 若出现，按未命中价计。缺字段当 0。

同一 `(turn, step)` 的流式 usage 与最终 `assistant/message.usage` 按 last-wins 差分，不重复累加。新 `turn` 开始时本轮归零，会话继续累加。

## 投影 `costMeter`

- `turnCostCny` / `sessionCostCny`（number）
- 本轮与会话的 `inputTokens` / `cacheReadTokens` / `cacheWriteTokens` / `outputTokens`
- `cacheNow` / `cacheAvg`：0–1 或 `null`
- `model`：string | null
- `tier`：`peak` | `offpeak` | null（最新一条已计价样本）
- `priced`：boolean（当前模型是否有官方价）

## 出错

- 投影未就绪或无用量：底栏仍在，值为 `-`
- 未知模型：金额 `—`，tooltip「无官方价」
- 折叠失败只 `console.warn`，不影响对话
- 数字是本地估算，不是账单

## 测试

纯函数（不启动 Electron / dsh）：高峰边界、Flash 空闲/高峰手算、流式不双计、换 turn 后本轮归零、缓存率、未知模型 `priced === false`。

不测：真实 API、抓价格页、像素截图。手工：`pnpm plugin:link` 后发一条消息，底栏人民币数字上升。
