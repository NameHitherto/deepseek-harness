---
description: "本地 Human-Agent 科研辅助模块及其模拟数据生命周期。"
---

# Human-Agent 科研辅助模块

[English](README.md) | 中文

## 摘要

科研插件可以在同一个服务实例内共享类型化的模拟数据。[科研预设补丁](cordis.patch.yml) 声明研究角色设定；它不挂载模拟数据服务。

## 目录

- [模拟数据](#mock-data)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="mock-data"></a>
## 模拟数据

[MockDataService](plugins/mock-data/src/index.ts) 提供 `ctx.studyMockData`。消费方声明 `inject: ['studyMockData']`。预设需要独立数据时，应在不同的 Cordis 隔离作用域中挂载各自的服务实例。

调用方提供 ISO 8601 时间戳 `currentTime`、任务提示词字符串 `taskPrompt`，以及用于评分的预期结果摘要字符串数组 `expectedResults`。服务信任调用方提供的时间戳，并保存 `expectedResults` 的冻结副本。

`initialize(key, value)` 返回幂等的清理函数。调用插件拥有该 effect。卸载该插件会移除其条目，提前清理则允许重新初始化。重复调用旧清理函数不会影响替代条目。

`read(key)` 返回保存的值。数据缺失时抛出代码为 `not-initialized` 的 `MockDataError`。重复初始化时抛出代码为 `already-initialized` 的错误，并保留已有值。两种错误均通过 `key` 标识条目。服务在自身的 Cordis 作用域内将所有条目保存在内存中。消费方负责向模型提交内容及记录对应的 Session 事件。

<a id="verification"></a>
## 验证

在仓库根目录运行：

```sh
pnpm exec tsc -p human-agent/tsconfig.json
node --import tsx/esm --test human-agent/plugins/mock-data/tests/mock-data.test.ts
```

这些本地辅助模块不在工作区包构建和根 Vitest 测试清单内；请显式运行上述命令。

<a id="dev-note"></a>
## 开发备注

无。
