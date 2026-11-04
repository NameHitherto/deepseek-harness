---
description: "在专用 Web profile 中选择科研 Agent 预设。"
kind: "package-bundle"
---

# 科研预设

[English](README.md) | 中文

## 摘要

`research-web` 只提供科研 Agent 预设。Web Host 管理数据模拟设置和场景库。预设提供 `get_current_time`，从该 Host 读取当前场景。

## 目录

- [配置 profile](#set-up-the-profile)
- [Profile 存储](#profile-storage)

<a id="set-up-the-profile"></a>
## 配置 profile

在 `research` 分支的仓库根目录执行以下命令，需先安装 DSH 开发依赖。第一条命令从官方 Web 模板创建 profile，会替换已有的同名 profile。

```powershell
pnpm dsh --profile research-web --from-default-profile web --dump-config
$dshLocalPlugins = Join-Path (Get-Location) 'human-agent/plugins'
pnpm dsh plugin --profile research-web add "link:$dshLocalPlugins/data-simulation" "link:$dshLocalPlugins/get-time" "link:$dshLocalPlugins/research-preset"
pnpm dsh --profile research-web --port 3081 --no-open
```

DSH 将 `@local/get-time` 安装为普通依赖。[预设补丁](cordis.patch.yml)将其挂载到科研预设内，禁用官方 Agent 预设并默认选择科研。[数据模拟组合包](../data-simulation/README.zh.md)挂载 Host 服务并添加设置页。

<a id="profile-storage"></a>
## Profile 存储

场景库和当前选择保存在 `$DSH_HOME/profiles/research-web/.data-simulation/scenarios.json`。同一个科研 Web Host 上的会话在每次调用时间工具时读取当前选择。科研会话日志和工作区记录分别使用该 profile 自己的 `sessions` 和 `storages` 目录。
