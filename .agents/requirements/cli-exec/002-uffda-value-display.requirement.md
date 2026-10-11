---
id: cli-exec-002
title: Default operational output uses Uffda data notation without implicit coercion
spec_ref: ".agents/specifications/languages/cli/language-and-output.spec.md#execution-output"
---

# Uffda value display

## Requirement

Preconditions:

- `exec`, `match` or `run` produces a runtime value.

Expected behavior:

- Without `--json`, a top-level string MUST be emitted as raw text followed by
  newline, and undefined MUST emit nothing.
- Other supported data values MUST use Uffda expression notation: whitespace
  separated arrays, comma separated object entries using computed quoted keys,
  properly escaped nested strings, scalar literals and negative integral values
  represented by `(sub 0 magnitude)`.
- The renderer MUST NOT call text or JSON hooks. Unsupported values,
  symbol-keyed properties, cycles, and numbers/strings without a lossless
  representation in the existing grammar MUST produce explicit output errors,
  not placeholders, omission, implementation source or JSON fallback.
- Shared acyclic data MUST remain displayable.
- `--json` MUST retain explicit JSON output compatibility, subject to callable
  serialization rejection.
- Parse and compile artifacts and structured diagnostics MUST retain JSON.

Postconditions:

- CLI display is separate from runtime implicit text conversion.
