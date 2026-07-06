---
id: resolve-001
title: Resolve handles reference, run, and special targets and delegates matching to selected behavior
spec_ref: ".agents/specifications/patterns/runtime/resolve.spec.md"
---

# Resolve Core Semantics

## Requirement

Preconditions:

- Resolve pattern is evaluated with sufficient resolution context.
- Resolve target kind is one of `reference`, `run`, or `special`.

Expected behavior:

- Resolve MUST determine a concrete target from its resolution strategy.
- For `reference` targets, Resolve MUST resolve visible rules and validate
  argument count and argument rule visibility.
- For `run` targets, Resolve MUST select named export when provided and
  otherwise select module default export.
- For `special` targets, Resolve MUST support module and rule special values and
  delegate to corresponding run/rule semantics.
- Resolve MUST delegate match behavior and input consumption to resolved target
  behavior.

Error behavior:

- Unknown rules, invalid argument bindings, unsupported special values, or
  missing run targets MUST report runtime error or governed failure outcome.
