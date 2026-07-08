---
id: modules-runtime-001
title: Module resolution supports configured extensions and rejects unknown extensions
spec_ref: ".agents/specifications/modules.spec.md#supported-module-sources; .agents/specifications/modules.spec.md#error-and-determinism-requirements"
---

# Extension Resolution and Unknown Extension Errors

## Requirement

Preconditions:

- Runtime module resolution is invoked with resolver configuration that supports
  declaration module extensions.
- The target module URL has either a supported or unsupported extension.

Expected behavior:

- Resolver MUST support `.ts`, `.js`, and `.json` declaration module sources.
- Resolver MUST return a successful module import result when supported
  declaration modules are valid.

Error behavior:

- Unknown file extensions MUST fail resolution with
  `MatchErrorCode.ModuleResolution`.

Postconditions:

- Extension-based module resolution behavior remains deterministic for fixed
  resolver configuration and module graph.
