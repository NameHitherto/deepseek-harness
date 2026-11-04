# Get time

English | [中文](README.zh.md)

`get_current_time` lets the model read the current date, clock time, weekday, and UTC offset. The tool reports the clock source in every result.

The Research Agent preset mounts this plugin. It reads the Host's `dataSimulation` service on each call and reports the system clock if the service is absent.

## Tool

`get_current_time` takes no arguments.

| Field | Meaning |
| --- | --- |
| `simulated` | `true` when a simulation scenario supplied the reading |
| `scenario` | the scenario id, only when simulated |
| `instant` | the instant in UTC, ISO 8601 |
| `timeZone` | zone label of the reading |
| `utcOffset` | offset such as `+08:00` |
| `localDate` | local calendar date, `YYYY-MM-DD` |
| `localTime` | local date and clock time |
| `weekday` | weekday name in English |
| `source` | `data-simulation` or `system` |

The rendered line names the source, for example `It is 2027-05-10 23:45:00 (Monday), America/Los_Angeles -07:00 — simulated by the "late-night" scenario.`

A prompt section tells the model to call the tool before stating today's date, the current time, or an interval measured from now.

## Configuration

| Field | Default | Meaning |
| --- | --- | --- |
| `timeZone` | the Host's zone | IANA zone used for the system clock |

An unknown zone name or configuration field fails the plugin load and reports the invalid value or key.
