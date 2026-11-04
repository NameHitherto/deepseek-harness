# 获取时间

[English](README.md) | 中文

`get_current_time` 让模型读取当前日期、时间、星期和 UTC 偏移量。工具在每次返回时说明时钟来源。

科研 Agent 预设挂载此插件。工具每次调用时读取 Host 的 `dataSimulation` 服务，服务缺失时返回系统时间。

## 工具

`get_current_time` 无需参数。

| 字段 | 含义 |
| --- | --- |
| `simulated` | 模拟场景提供读数时为 `true` |
| `scenario` | 场景 ID，仅模拟读数包含此字段 |
| `instant` | ISO 8601 格式的 UTC 时间点 |
| `timeZone` | 读数的时区名称 |
| `utcOffset` | UTC 偏移量，例如 `+08:00` |
| `localDate` | 本地日历日期，格式为 `YYYY-MM-DD` |
| `localTime` | 本地日期和时间 |
| `weekday` | 英文星期名称 |
| `source` | `data-simulation` 或 `system` |

工具的文本结果包含来源，例如 `It is 2027-05-10 23:45:00 (Monday), America/Los_Angeles -07:00 — simulated by the "late-night" scenario.`

系统提示要求模型在说明今天的日期、当前时间或以此刻为起点的时间间隔前调用此工具。

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `timeZone` | Host 的时区 | 系统时钟使用的 IANA 时区 |

插件遇到未知时区或配置字段时会加载失败，并报告无效的值或字段。
