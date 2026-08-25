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
- 安装包可带一份副本；开发时用 junction 链到本仓库，已安装的 DSH 就能直接测
- 不要 `require('electron')`，不要假设 `window.dshDesktop` 存在

边写边测：

```powershell
# 链到已安装 DeepSeek Harness 的 web profile（打印出的 DSH_HOME 应是 AppData\Roaming\DeepSeek Harness\dsh-home）
pnpm plugin:link

# 开发期间保持链接
pnpm plugin:dev
```

改 `lib/client.js` 后在 DSH 窗口 Ctrl+R；改 `lib/index.js` 后重启 DeepSeek Harness。

指定别的数据目录：

```powershell
$env:DSH_HOME = 'D:\path\to\dsh-home'
pnpm plugin:link
```

## 以后要拆独立仓库时

优先 **submodule**（钉 commit），不要用 subtree。拆仓前先能独立 `pnpm pack` / 发 npm。
