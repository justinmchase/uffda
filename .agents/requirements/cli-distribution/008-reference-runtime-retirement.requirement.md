---
id: cli-distribution-008
title: Rust development and acceptance do not depend on the retired Deno runtime
spec_ref: ".agents/specifications/languages.spec.md#runtime-implementation; .agents/specifications/languages/compiler-bootstrap.spec.md#full-circle-validation-requirements"
---

# Reference runtime retirement

## Requirement

Preconditions:

- The Rust production cutover and full-circle bootstrap gate have passed.

Expected behavior:

- `src/` MUST retain authored `.uff` grammars but MUST NOT contain a tracked
  TypeScript or JavaScript runtime, CLI, or grammar wrapper implementation.
- The checked-in JSON compatibility fixtures under `test/rust/` MUST remain
  available to the Rust parser, process, and runtime regression tests. Tests
  MUST NOT regenerate expected outcomes from the removed reference runtime.
- Development tasks `cli`, `compile:cli`, and `test` MUST use the Rust CLI and
  test suite. `compile:lang` MUST continue using the published CLI directly.
- Node.js helper tests MUST have an explicit scope that excludes obsolete
  reference-only and scratch trees. The release version hooks MUST NOT address
  deleted files.
- The repository's `fmt:uff` task MUST format authored grammars and examples
  explicitly, without discovering scratch trees or Cargo package copies.
- Repository helpers and codec measurement tooling MUST run with Node.js.
  The VS Code extension keeps its independent package boundary, and JSR
  publishing MAY use the JSR CLI.
- The runtime package MUST contain its codec adapter sources, separately from
  the standalone codec crate, while retaining the `uffda_runtime::codec` API.
- Published grammar exports and the full-circle bootstrap and standalone
  acceptance gates MUST remain unchanged.

Postconditions:

- Tests: `tests/build.rs`, `src/cli/options/tests.rs`,
  `tests/cli.rs`, `src/lang_tests/`, and
  `tests/standalone_acceptance.rs`.
