# Data simulation

English | [中文](README.zh.md)

Supplies a switchable library with a simulated current time, a task prompt, and a list of scoring criteria per scenario. Other plugins read it through the `dataSimulation` service.

Switch, add, edit, and delete scenarios in **Settings → Built-in plugins → Data simulation**. Consumers see the new selection on their next read. The library persists in `<profile>/.data-simulation/scenarios.json` and starts with four built-in scenarios. The `research-web` profile mounts the service and settings page at the Web application level. The Research Agent preset reads the service through its clock tool.

Each built-in prompt supplies the task materials and names the deliverables the user needs. In the editor, use **Add expected result** to enter a separate scoring item for each answer or observable result you want to check.

## Service

Consumers declare `dataSimulation` in `inject` and read it as `ctx.dataSimulation`, or read `ctx.get('dataSimulation')` without an injection edge.

| Member | Returns |
| --- | --- |
| `list()` | every scenario with fields `{ id, label, time, timeZone?, prompt?, expected, reading }` |
| `state()` | `{ activeId, scenarios, presets, storage }` — the settings page model |
| `activeId()` | id of the selected scenario |
| `current()` | only the selected scenario's simulated clock |
| `active()` | the selected scenario's fields plus its `reading` |
| `presets()` | the shipped scenarios, re-addable after a delete |
| `activate(id)` | select a scenario and store the selection |
| `upsert(scenario)` | create or replace one scenario, then store the library |
| `remove(id)` | delete one scenario, then store the library |
| `replace({ scenarios, activeId })` | write the whole library |

Mutating methods wait for the storage result. `storage.persisted` reports whether the change was saved, and `storage.reason` describes a failure. A failed write leaves the change active in memory.

The library keeps at least one scenario. `remove` and `replace` reject a change that would leave it empty.

`reading` contains the clock data for a scenario.

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

Consumers can submit `prompt` as the user task and score the response against each item in `expected`. Keep `expected` in the scoring path. Plugins that pass scenario data to the model must follow the [data simulation rules](../../AGENTS.md#data-simulation).

## Change notification

The plugin emits `data-simulation/change` on its own context with the new state. Consumers that react to a switch can listen on that context.

```js
export function apply(ctx) {
  ctx.on('data-simulation/change', state => { /* read state.activeId */ })
}
```

Pulling `ctx.dataSimulation.current()` per request needs no listener.

## Scenario fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | lowercase words joined by hyphens; row key and file key |
| `label` | no | display name; defaults to the id |
| `time` | yes | ISO 8601 date-time that must name its own offset (`Z` or `±HH:MM`) |
| `timeZone` | no | IANA zone; with it the reading is that zone's wall clock, without it the offset's |
| `prompt` | no | the task prompt a consumer may present as the task |
| `expected` | no | ordered array of non-empty strings, one scoring criterion per item. Omit it to use `[]` |

## Failure behavior

The plugin reports the offending path when the stored library uses an unsupported version, repeats an id, or holds an invalid scenario. Remove the file to reload the built-in scenarios.
