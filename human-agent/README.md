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

[MockDataService](plugins/mock-data/src/index.ts) provides `ctx.studyMockData`. Consumers declare `inject: ['studyMockData']`. Mount separate service instances in separate Cordis isolation scopes when presets need independent data.

Callers supply `currentTime` as an ISO 8601 timestamp, `taskPrompt` as a string, and `expectedResults` as an array of summary strings for scoring. The service trusts caller-supplied timestamps and stores a frozen copy of `expectedResults`.

`initialize(key, value)` returns an idempotent disposer. The calling plugin owns the effect. Unloading that plugin removes its entry, and early disposal allows reinitialization. Repeated calls to an old disposer leave a replacement entry intact.

`read(key)` returns the stored value. Missing data throws `MockDataError` with code `not-initialized`. Duplicate initialization throws code `already-initialized` and preserves the stored value. Both errors identify the entry through `key`. The service keeps all entries in memory within its Cordis scope. Consumers own any model submission and its Session logging.

<a id="verification"></a>
## Verification

Run from the repository root:

```sh
pnpm exec tsc -p human-agent/tsconfig.json
node --import tsx/esm --test human-agent/plugins/mock-data/tests/mock-data.test.ts
```

These local helpers are outside the workspace package build and the root Vitest test inventory; run the commands above explicitly.

<a id="dev-note"></a>
## Dev Note

None.
