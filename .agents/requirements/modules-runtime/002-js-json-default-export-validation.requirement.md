---
id: modules-runtime-002
title: JSON declaration modules validate their structure and normalize failures
spec_ref: ".agents/specifications/modules.spec.md#json-declaration-modules"
---

# JSON Declaration Validation

## Requirement

Preconditions:

- Either runtime imports a `.json` declaration module.

Expected behavior:

- JSON MUST contain a module declaration object with array-valued imports,
  exports, and rules. Optional funcs and decorators MUST be arrays when present;
  omitted fields MUST be treated as empty arrays for older artifacts.

Error behavior:

- Invalid declaration structure MUST fail with a module-resolution error.
- If a `.json` declaration module import/parsing fails, resolution MUST fail
  with a module-resolution error.

Postconditions:

- Invalid declaration modules do not produce partially successful resolution
  results.

## Test plan

- `rust/src/resolver.rs`, `rust/src/resolver/graph/tests.rs`,
  `rust/src/resolver/packages/tests.rs`, `rust/src/resolver/ported_tests.rs`,
  `rust/src/runtime/module_ports.rs`
