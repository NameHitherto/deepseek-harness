---
kind: upgrade-guide
description: "The research data simulation plugin replaces its single scoring reference with an array of criteria."
---

# Data simulation uses an array of scoring criteria

English | [中文](guide.zh.md)

## Change

The local `@local/data-simulation` plugin exposes `expected` as a string array in scenario data. Version 1 libraries used a single `expectedResult` string. The next library save writes version 2.

## Migration

1. Restart the research profile. The plugin reads the existing library automatically. It refreshes unedited built-in scenarios and keeps each edited or custom scenario's task prompt and scoring text, with the text as one array item.
2. In **Settings → Built-in plugins → Data simulation**, confirm that the scenario selection and any custom tasks are present. Edit a scenario to split an existing scoring reference into separate items.
3. If your code reads or writes scenarios, use `expected` and pass one string per criterion. Check that the consumer can score each item separately. [Plugin reference](../../../../human-agent/plugins/data-simulation/README.md)
