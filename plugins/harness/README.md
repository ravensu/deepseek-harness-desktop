# harness 插件（纯 dsh）

在此目录新建标准 DeepSeek Harness 插件包，例如：

```text
plugins/harness/dsh-my-feature/
  package.json          # 含 dsh.bundle / dsh.client
  cordis.patch.yml
  lib/index.js
  lib/client.js         # 可选，设置页 UI
```

现有：
- `dsh-cost-meter`：统计栏费用估算；设置页可勾选字段并拖放排序
- `dsh-im-gateway`：微信私聊驱动完整 Agent（iLink Bot API，桌面开着才在线）

## 边写边在已安装的 DSH 里测

把 profile 里的插件目录做成指向本仓库源码的 junction（Windows）/ 符号链接（macOS/Linux）。改文件立刻出现在已安装应用的数据目录里。

```powershell
# 一次性链接到已安装 DeepSeek Harness 的 dsh-home
pnpm plugin:link

# 开发时保持链接，并在插件增删时自动补链
pnpm plugin:dev
```

脚本会打印 `DSH_HOME=...`。确认是 `...\DeepSeek Harness\dsh-home`，不是临时目录。

之后：

| 改了什么 | 怎么让 DSH 看到 |
|---|---|
| `lib/client.js`、设置页 UI | 在 DSH 窗口按 **Ctrl+R** |
| `lib/index.js`、host 逻辑 | 完全退出并重新打开 DeepSeek Harness，或用应用菜单重启 Harness |

安装版启动时只会补拷缺失的插件，**不会**把已有的实时链接改回安装包副本。

指定别的数据目录：

```powershell
$env:DSH_HOME = 'D:\path\to\dsh-home'
pnpm plugin:link
```
