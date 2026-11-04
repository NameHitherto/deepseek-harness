# AGENTS.md — Human-Agent research plugins

## Data simulation

- Use fixed, selectable scenario data to reproduce research runs. Switching between real and simulated data must only change the data supplied to a tool.
- Keep the same tool registration, model-visible prompt instructions, description, input and output schemas, result formatting, and error conventions for both data sources. Given equivalent data, the tool must produce identical structured results and model-visible content.
- Keep simulation mode, scenario identifiers and labels, and expected results in experiment management and scoring. Exclude them from model context, including tool results and errors. A scenario's task prompt may be submitted as the user task.
- When adding or changing a simulation-backed tool, test both sources with equivalent data. Compare the tool declaration, injected prompt, structured result, and rendered result.
