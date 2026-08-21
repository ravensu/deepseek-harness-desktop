# DeepSeek Harness 桌面版

在独立窗口里运行官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI。桌面层是 **Electron 薄壳**：拉起本地 `dsh web`、托管窗口，并在官方设置里提供「核心管理」。

## 架构（壳 / 核心分离）

| 层 | 位置 | 如何更新 |
|---|---|---|
| Electron 壳 | 安装目录 | 重装安装包（可由 CI Release 发布） |
| Harness 核心 (sidecar) | `%LOCALAPPDATA%\dsh-desktop\harness` 等 | 设置 → **核心管理**，从 npm 安装 |
| 用户数据 | `%APPDATA%\DeepSeek Harness\dsh-home` | 不随 sidecar 替换删除 |

安装包**不内置**完整 Harness，只带 `bootstrap-node`（Node + pnpm）。**首次启动**按 `package.json` → `dshDesktop.seedDsh` 从 npm 安装核心。

## 本地开发

需要 Node.js 22+ 与 pnpm：

```powershell
pnpm install
pnpm test
pnpm start
```

`pnpm start` 会准备本地 `sidecar/harness`（开发方便）；打包产物走「首次启动再装核」。

国内镜像示例：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:DSH_NPM_REGISTRY = 'https://registry.npmmirror.com'
```

## 本地打包

原生模块不能交叉编译，请在对应系统上执行：

```powershell
pnpm dist        # 当前平台
pnpm dist:win
pnpm dist:mac
pnpm dist:linux
```

产物在 `release/`。

## CI/CD 自动发版

推送符合 `v*` 的 tag 即可触发三端打包并发布：

```bash
# 1. 确认 package.json 里 dshDesktop.seedDsh 等配置无误
# 2. 打 tag（版本号会同步进安装包名）
git tag v0.1.0
git push origin v0.1.0
```

### GitHub

| 工作流 | 触发 | 作用 |
|---|---|---|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | push / PR | 跑测试 |
| [`.github/workflows/release.yml`](.github/workflows/release.yml) | `v*` tag 或手动 | Win/macOS/Linux 打包 → GitHub Release |

手动：Actions → **Release** → Run workflow（可勾选发布 Release）。

### GitLab

配置见 [`.gitlab-ci.yml`](.gitlab-ci.yml)。

- **Linux**：默认 shared runner
- **Windows / macOS**：需自备 runner，并打上 `windows` / `macos` tag
- tag `v*` 时：上传 Generic Package，并创建 GitLab Release

可选 CI 变量：`ENABLE_WIN_BUILD`、`ENABLE_MAC_BUILD`、`ENABLE_LINUX_BUILD`。

### 版本号

CI 打包前会执行 `scripts/sync-version-from-ci.cjs`：

- tag `v0.2.0` → `package.json` / 产物名使用 `0.2.0`
- 也可设 `DSH_RELEASE_VERSION=0.2.0` 覆盖

含 `-` 的 tag（如 `v0.2.0-rc.1`）在 GitHub 上会标为 prerelease。
