---
id: uffda-runtime-compilation-004
title: Host APIs orchestrate but do not implement semantic compilation
spec_ref: ".agents/specifications/languages/uffda-runtime-compilation.spec.md#host-integration-boundary"
---

# Host Orchestration Boundary

## Requirement

Preconditions:

- A host API exposes Uffda syntax module compilation.

Expected behavior:

- The host API MAY configure resolution, execute the compiler entry rule, and
  unwrap its successful result.
- The host API MUST delegate semantic syntax-to-runtime transformation to the
  compiler language.
- The host API MUST NOT traverse declaration sequences or dispatch declaration
  variants to construct runtime declarations.

Postconditions:

- Parsing, compilation, and execution remain independently invocable and
  testable operations.
