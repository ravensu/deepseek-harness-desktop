# harness 插件（纯 dsh）

在此目录新建标准 DeepSeek Harness 插件包，例如：

```text
plugins/harness/dsh-my-feature/
  package.json          # 含 dsh.bundle / dsh.client
  cordis.patch.yml
  lib/index.js
  lib/client.js         # 可选，设置页 UI
```

用 `pnpm plugin:link` 链到当前 profile 的 `node_modules` 并写入 `dsh.profile.bundles`。
