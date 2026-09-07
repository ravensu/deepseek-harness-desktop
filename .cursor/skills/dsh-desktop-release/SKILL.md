---
name: dsh-desktop-release
description: >-
  DeepSeek Harness Desktop 发版。用户说发版、上传、release、打 tag、GitHub Release 时使用。
  本地只提交并推 main；push 后 Package workflow 自动打 tag，Release workflow 自动发布。
---

# 桌面壳发版

两段，不要在本地打 tag。

## 1. 本地：上传代码

1. `node --test test/*.test.js plugins/harness/dsh-cost-meter/test/*.test.js plugins/harness/dsh-im-gateway/test/*.test.js`
2. 提交（不改 `package.json` 的 version，CI 会按 tag 同步）
3. `git pull --rebase origin main`（禁止 force push main）
4. `git push origin main`

**禁止本地：** `git tag`、`git push origin v*`、本机 `pnpm dist*` 当发版。

## 2. CI：自动发版

push main 命中 package.yml 的 paths（src/**、scripts/**、plugins/** 等）后：

1. Package workflow 四端（Win / mac arm64 / mac x64 / Linux）并行打包，产物为临时 artifact（14 天）
2. 四端全绿 → `tag-release` job 自动打下一个 `v*` patch tag 并推送
   - 只认正式版 tag `vX.Y.Z`，忽略 `-rc` 预发布
   - 幂等：当前 commit 已有正式 tag 时跳过，重跑同一 run 不会重复发版
3. tag push 触发 Release workflow：四端正式打包（版本号由 `sync-version-from-ci.cjs` 按 tag 写入）→ Publish GitHub Release（安装包 + `latest*.yml`）
4. 旧壳通过 electron-updater 自动检测到新版本

## 失败处理

- Package 红：拉日志修 workflow/脚本，推 main 重跑
- tag 冲突（并发 push 算出同一版本）：后到的 run 会因 tag 已存在而跳过，属正常
- Release 红：修复推 main 后，在失败 tag 的下一个 patch 手动补打新 tag 重发

约束：不要改 git config；不要 force push main / 已发布的 tag；回复用简体中文。

## 参考

- 仓库：`ravensu/deepseek-harness-desktop`
- workflow：`.github/workflows/package.yml`（打包 + 打 tag）、`.github/workflows/release.yml`（正式发布）
- tag 含 `-`（如 `v0.1.6-rc.1`）会标 prerelease
