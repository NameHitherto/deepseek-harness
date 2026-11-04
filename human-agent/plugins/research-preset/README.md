---
description: "Selects the Research Agent preset in a dedicated Web profile."
kind: "package-bundle"
---

# Research preset

English | [中文](README.zh.md)

## Summary

Use `research-web` to run Web sessions with Research as the sole Agent preset. The Web Host owns the data simulation settings and scenario library. The preset supplies `get_current_time` to read the active scenario and `research_todo_write` to track work in stages. Expand the task list above the composer to see a one-sentence result under each completed task.

## Table of contents

- [Set up the profile](#set-up-the-profile)
- [Profile storage](#profile-storage)

<a id="set-up-the-profile"></a>
## Set up the profile

Run these commands from the root of the `research` branch with the DSH development dependencies installed. The first command creates the profile from the official Web template and replaces any existing profile with that name.

```powershell
pnpm dsh --profile research-web --from-default-profile web --dump-config
$dshLocalPlugins = Join-Path (Get-Location) 'human-agent/plugins'
pnpm dsh plugin --profile research-web add "link:$dshLocalPlugins/data-simulation" "link:$dshLocalPlugins/get-time" "link:$dshLocalPlugins/research-preset"
pnpm dsh --profile research-web --port 3081 --no-open
```

DSH installs `@local/get-time` as a plain dependency. The [preset patch](cordis.patch.yml) mounts it inside Research, disables the official Agent preset declarations, and selects Research by default. The [data simulation bundle](../data-simulation/README.md) mounts the Host service and adds the settings page.

The preset patch mounts the [research task tool](todo/tool.js) inside the Research Agent and the [task list](todo/client.js) above the composer. Each successful update stores the complete list in the tool result's display metadata. The list remains visible when reopening the Session and clears when a new turn starts. Later updates that keep a completed task must include its result again.

<a id="profile-storage"></a>
## Profile storage

The profile stores its scenario library and active selection in `$DSH_HOME/profiles/research-web/.data-simulation/scenarios.json`. Sessions on the same Research Web Host read the current selection on each clock call. Research session logs and workspace records use the profile's own `sessions` and `storages` directories.
