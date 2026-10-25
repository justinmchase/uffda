---
id: cli-exec-002
title: Default operational output uses lossless Uffda data codec records
spec_ref: ".agents/specifications/languages/cli/language-and-output.spec.md#execution-output"
---

# Uffda value display

## Requirement

Preconditions:

- `exec`, `match` or `run` produces a runtime value.

Expected behavior:

- Without `--json`, every supported value MUST be emitted as one compact Uffda
  data codec record followed by LF. Top-level strings MUST be quoted and
  escaped; undefined MUST emit `undefined` followed by LF.
- Output MUST use codec syntax: whitespace-separated arrays and object entries,
  quoted object keys, negative and fractional numeric literals, preserved
  negative zero and non-finite numbers, BigInt suffixes, and fixed native tags.
  Strings MUST preserve isolated surrogate units without replacement and MUST
  NOT interpolate braces.
- The renderer MUST NOT call text or JSON hooks. Unsupported values,
  symbol-keyed properties, cycles, and values without a lossless representation
  in the data codec MUST produce explicit output errors, not placeholders,
  omission, implementation source or JSON fallback.
- Repeated composite references MUST fail explicitly, including shared acyclic
  data, following the codec identity contract.
- `--json` MUST retain explicit JSON output compatibility, subject to callable
  serialization rejection.
- Parse and compile artifacts and structured diagnostics MUST retain JSON.

Postconditions:

- CLI display is separate from runtime implicit text conversion.
- Tests: `tests/cli_data.rs` and `src/output.rs`.
