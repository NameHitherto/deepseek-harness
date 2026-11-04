# 获取时间

[English](README.md) | 中文

`get_current_time` 让模型读取当前日期、时间、星期和 UTC 偏移量。

科研 Agent 预设挂载此插件。工具每次调用时读取 Host 的 `dataSimulation` 服务，服务缺失时使用系统时钟。两种时钟使用相同的工具说明、提示段落和结果格式。

## 工具

`get_current_time` 无需参数。

| 字段 | 含义 |
| --- | --- |
| `instant` | ISO 8601 格式的 UTC 时间点 |
| `timeZone` | IANA 时区名称或固定偏移量标签，例如 `UTC+08:00` |
| `utcOffset` | UTC 偏移量，例如 `+08:00` |
| `localDate` | 本地日历日期，格式为 `YYYY-MM-DD` |
| `localTime` | 本地日期和时间 |
| `weekday` | 英文星期名称 |

工具根据本地时钟字段生成文本，例如 `It is 2026-03-02 09:30:00 (Monday), Asia/Shanghai +08:00.`

系统提示要求模型在说明今天的日期、当前时间或以此刻为起点的时间间隔前调用此工具。

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `timeZone` | Host 的时区 | 系统时钟使用的 IANA 时区或 UTC 偏移量 |

插件遇到未知时区或配置字段时会加载失败，并报告无效的值或字段。
