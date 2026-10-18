---
id: standard-library-001
title: TypeScript and Rust expose the same declared default globals
spec_ref: ".agents/specifications/standard-library.spec.md#default-global-surface"
---

# Shared default-global surface

## Requirement

Preconditions:

- The runtime is initialized with its default global environment.

Expected behavior:

- TypeScript and Rust MUST expose exactly the names and declared arities in
  `test/rust/globals-surface-fixtures.json`.
- Every TypeScript default global MUST carry non-empty descriptive metadata.
- The fixture name set MUST contain no duplicate names.
- The shared behavior corpus MUST include at least two cases for every name in
  the surface fixture. Cases MUST retain explicit expected values or expected
  errors; runtime-specific expected values remain explicit rather than being
  treated as cross-runtime parity.
- The fixture is a shared compatibility contract, not an ordering contract.

Postconditions:

- Every default global name resolves to the corresponding callable, with the
  declared callable arity available through the runtime's existing metadata
  surface.
- Tests: `rust/src/globals/tests.rs`
  (`native_callable_own_fields_match_all_typescript_names_and_arities`).
