# 插件目录约定

本仓用 **monorepo** 放插件，**不上 submodule / subtree**（除非某个插件已独立发版、独立权限）。

```text
plugins/
  desktop/     # 壳专用：可依赖 window.dshDesktop / 核心桥；随壳打包并写入 profile
  harness/     # 纯 dsh：标准 Cordis bundle / client，不依赖 Electron
```

## desktop（壳专用）

- 路径：`plugins/desktop/<package-name>/`
- 启动时由壳 `ensureDesktopPlugins` 拷进 `%APPDATA%\...\dsh-home\profiles\web`
- 打进安装包（见 `electron-builder.yml`）
- 示例：`dsh-desktop-core`（设置 → 核心管理）

开发：改代码 → 升 `package.json` version（或删 profile 里对应 `node_modules`）→ 重启壳。

## harness（纯 dsh）

- 路径：`plugins/harness/<package-name>/`
- **不**打进 Electron 安装包；开发时链到当前 `DSH_HOME` profile，或以后发 npm 再 `dsh plugin add`
- 不要 `require('electron')`，不要假设 `window.dshDesktop` 存在

开发链接：

```powershell
# 默认链到桌面壳数据目录下的 web profile
pnpm plugin:link

# 或指定 DSH_HOME
$env:DSH_HOME = 'D:\path\to\dsh-home'
pnpm plugin:link
```

## 以后要拆独立仓库时

优先 **submodule**（钉 commit），不要用 subtree。拆仓前先能独立 `pnpm pack` / 发 npm。
