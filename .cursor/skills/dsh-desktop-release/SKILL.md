---
name: dsh-desktop-release
description: >-
  DeepSeek Harness Desktop 发版。用户说发版、上传、release、打 tag、GitHub Release 时使用。
  本地只提交并推 main；打 tag、跟 CI、修失败一律派 Cloud Agent。
---

# 桌面壳发版

两段，不要在本地打 tag。

## 1. 本地：上传代码

1. `node --test test/*.test.js plugins/harness/dsh-cost-meter/test/*.test.js plugins/harness/dsh-im-gateway/test/*.test.js`
2. 提交（不改 `package.json` 的 version，CI 会按 tag 同步）
3. `git pull --rebase origin main`（禁止 force push main）
4. `git push origin main`

**禁止本地：** `git tag`、`git push origin v*`、本机 `pnpm dist*` 当发版。

## 2. Cloud Agent：发版

派 `Task`：`environment=cloud`，`cloud_base_branch=main`，`subagent_type=generalPurpose`。

云端要做：

1. `git fetch --tags`；下一个 tag 为最新 `v*` 的 patch +1（当前线 `v0.1.x`）
2. `git tag vX.Y.Z && git push origin vX.Y.Z`（推 tag 会跑 `.github/workflows/release.yml`）
3. 用 `gh` 等到 Release 跑完
4. 失败则拉日志修 workflow/脚本，推 main，打**新** tag（不要 force push 已发布的 tag / main）
5. 成功则回报：Release URL、Actions URL、安装包列表

约束：不要改 git config；不要 force push main；回复用简体中文。

## 参考

- 仓库：`ravensu/deepseek-harness-desktop`
- README「CI/CD 自动发版」
- tag 含 `-`（如 `v0.1.6-rc.1`）会标 prerelease
