---
id: cli-command-model-001
title: CLI command topology and exit-code mapping are deterministic
spec_ref: ".agents/specifications/languages/cli/command-model.spec.md#command-topology-contract; .agents/specifications/languages/cli/command-model.spec.md#exit-code-policy-contract"
---

# CLI Command Topology and Exit Codes

## Requirement

Preconditions:

- A CLI invocation includes a process working directory and argument vector.

Expected behavior:

- Command families MUST resolve to compile, parse, exec, or interactive mode.
- Successful invocation-contract resolution MUST map to exit code `0`.
- Usage/flag-validation failures MUST map to a stable usage exit code.
- Configuration failures MUST map to a stable configuration exit code.

Postconditions:

- Operators and automation can classify invocation outcomes from exit code and
  deterministic mode resolution.
