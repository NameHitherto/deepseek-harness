# 数据模拟

[English](README.md) | 中文

提供可切换的场景库。每个场景包含模拟当前时间、任务提示和预期结果。其他插件通过 `dataSimulation` 服务读取场景库。

在**设置 → 插件 → 数据模拟**中切换、新增、编辑或删除场景。消费方在下次读取时获取新的选择。场景库保存在 `<profile>/.data-simulation/scenarios.json`，初始包含四个内置场景。`research-web` 在 Web 应用层挂载服务和设置页。科研 Agent 预设通过时间工具读取该服务。

## 服务

消费方可以在 `inject` 中声明 `dataSimulation` 后读取 `ctx.dataSimulation`，也可以直接读取 `ctx.get('dataSimulation')`。

| 成员 | 返回值 |
| --- | --- |
| `list()` | 所有场景，字段为 `{ id, label, time, timeZone?, prompt?, expectedResult?, reading }` |
| `state()` | 设置页使用的 `{ activeId, scenarios, presets, storage }` |
| `activeId()` | 当前场景的 ID |
| `current()` | 当前场景的模拟时钟读数 |
| `active()` | 当前场景的字段及其 `reading` |
| `presets()` | 内置场景，删除后可重新添加 |
| `activate(id)` | 选择场景并保存选择 |
| `upsert(scenario)` | 新增或替换一个场景并保存场景库 |
| `remove(id)` | 删除一个场景并保存场景库 |
| `replace({ scenarios, activeId })` | 写入整个场景库 |

修改方法会等待存储结果。`storage.persisted` 表示改动是否已保存，`storage.reason` 说明失败原因。写入失败时，改动仍在内存中生效。

场景库至少保留一个场景。`remove` 和 `replace` 会拒绝清空场景库的改动。

`reading` 包含场景的时钟数据。

```json
{
  "scenarioId": "requirement-review",
  "label": "Requirement review",
  "simulated": true,
  "timeZone": "Asia/Shanghai",
  "utcOffset": "+08:00",
  "utcOffsetMinutes": 480,
  "localDate": "2026-03-02",
  "localTime": "2026-03-02 09:30:00",
  "wallClock": "09:30:00",
  "weekday": "Monday",
  "instant": "2026-03-02T01:30:00.000Z"
}
```

消费方可从场景读取任务提示和预期结果。时钟读数只包含时间和场景标识。

## 变更通知

插件在自己的上下文中发出 `data-simulation/change`，事件携带新状态。需要响应场景切换的消费方可在该上下文中监听。

```js
export function apply(ctx) {
  ctx.on('data-simulation/change', state => { /* read state.activeId */ })
}
```

按需读取 `ctx.dataSimulation.current()` 无需监听事件。

## 场景字段

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `id` | 是 | 由连字符连接的小写单词，用作记录和文件中的键 |
| `label` | 否 | 显示名称，默认使用 ID |
| `time` | 是 | 必须包含偏移量的 ISO 8601 日期和时间（`Z` 或 `±HH:MM`） |
| `timeZone` | 否 | IANA 时区。填写时使用该时区的本地时间，否则使用偏移量对应的本地时间 |
| `prompt` | 否 | 消费方可呈现的任务提示 |
| `expectedResult` | 否 | 消费方可用于比较的预期结果 |

## 失败处理

当已保存的场景库使用不支持的版本、包含重复 ID 或包含无效场景时，插件会报告对应的路径。移除该文件可重新载入内置场景。
