---
description: "Local Human-Agent research helpers and their simulation data lifecycle."
---

# Human-Agent research helpers

English | [中文](README.zh.md)

## Summary

Research plugins can share typed simulation data within one service instance. The [study preset patch](cordis.patch.yml) declares the research persona; it does not mount the mock data service.

## Table of Contents

- [Mock data](#mock-data)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="mock-data"></a>
## Mock data

[MockDataService](src/mock-data.ts) provides `ctx.studyMockData`. Consumers declare `inject: ['studyMockData']`. Mount separate service instances in separate Cordis isolation scopes when presets need independent data.

`initialize('currentTime', value)` stores a caller-supplied ISO 8601 timestamp and returns an idempotent disposer. Initialization is a calling-plugin effect: unloading that plugin removes its entry, while early disposal permits reinitialization. Repeated calls to an old disposer leave a replacement entry intact. The service neither reads the clock nor validates timestamp strings.

`read('currentTime')` returns the stored string. Missing data throws `MockDataError` with code `not-initialized`; duplicate initialization throws code `already-initialized` without replacing the value. Both errors identify the entry through `key`. Data remains in memory and is not included in Session events or model requests.

<a id="verification"></a>
## Verification

Run from the repository root:

```sh
pnpm exec tsc -p human-agent/tsconfig.json
node --import tsx/esm --test human-agent/tests/mock-data.test.ts
```

These local helpers are outside the workspace package build and the root Vitest test inventory; run the commands above explicitly.

<a id="dev-note"></a>
## Dev Note

None.
