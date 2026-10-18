---
id: modules-runtime-001
title: Both runtimes load uff and json modules and reject executable file imports
spec_ref: ".agents/specifications/modules.spec.md#supported-module-sources; .agents/specifications/modules.spec.md#error-and-determinism-requirements"
---

# Extension Resolution and Unknown Extension Errors

## Requirement

Preconditions:

- Runtime module resolution is invoked with resolver configuration that supports
  declaration module extensions.
- The target module URL has either a supported or unsupported extension.

Expected behavior:

- Both resolvers MUST support `.json` declarations at their actual paths.
- Both resolvers MUST reject `.ts`, `.js`, and other unsupported file extensions
  before reading or executing files, even with custom extension resolvers.
- Explicitly supplied declarations MAY use such URLs as identities without
  loading files. Explicit CLI `--ast` input remains supported.
- Resolver MUST support logical `.uff` module URLs by remapping to compiled
  artifacts in the resolver's artifact layout (see `cli-bootstrap-004`).
- Resolver MUST return a successful module import result when supported
  declaration modules are valid.

Error behavior:

- Unknown file extensions MUST fail resolution with
  `MatchErrorCode.ModuleResolution`.

Postconditions:

- Extension-based module resolution behavior remains deterministic for fixed
  resolver configuration and module graph.

## Test plan

- `rust/src/resolver.rs`, `rust/src/resolver/graph/tests.rs`, `rust/src/resolver/packages/tests.rs`, `rust/src/resolver/ported_tests.rs`, `rust/src/runtime/module_ports.rs`
