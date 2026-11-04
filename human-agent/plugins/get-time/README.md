# Get time

English | [中文](README.zh.md)

`get_current_time` lets the model read the current date, clock time, weekday, and UTC offset.

The Research Agent preset mounts this plugin. It reads the Host's `dataSimulation` service on each call and uses the system clock if the service is absent. Both clocks use the same tool description, prompt section, and result format.

## Tool

`get_current_time` takes no arguments.

| Field | Meaning |
| --- | --- |
| `instant` | the instant in UTC, ISO 8601 |
| `timeZone` | IANA zone name or a fixed offset label such as `UTC+08:00` |
| `utcOffset` | offset such as `+08:00` |
| `localDate` | local calendar date, `YYYY-MM-DD` |
| `localTime` | local date and clock time |
| `weekday` | weekday name in English |

The rendered line uses the local clock fields, for example `It is 2026-03-02 09:30:00 (Monday), Asia/Shanghai +08:00.`

A prompt section tells the model to call the tool before stating today's date, the current time, or an interval measured from now.

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `timeZone` | the Host's zone | IANA zone or UTC offset used for the system clock |

An unknown zone name or configuration field fails the plugin load and reports the invalid value or key.
