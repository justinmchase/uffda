---
id: cli-bootstrap-004
title: .uff imports resolve mirrored bin syntax-AST artifacts
spec_ref: ".agents/specifications/modules.spec.md#uffda-source-imports-uff; .agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Uff Import Resolves Bin AST

## Requirement

Preconditions:

- An authored `.uff` source has been compiled into a syntax-AST JSON artifact
  under the configured artifact root (default `./bin`), using the CLI path
  layout `<artifact-root>/ast/<stable-source>.uffda.ast.json`.
- A module import names that source with a `.uff` URL (relative or absolute).

Expected behavior:

- Runtime resolution MUST remap the logical `.uff` URL to the mirrored artifact
  path and MUST NOT read the `.uff` source text.
- The runtime MUST load the artifact JSON and lower it to a module declaration
  via the Uffda runtime compiler.
- Module identity and resolver cache keys MUST remain the logical `.uff` URL.
- Direct `.ts`, `.js`, and `.json` imports MUST resolve to their actual paths.

Error behavior:

- A missing artifact MUST fail with `MatchErrorCode.ModuleResolution` and MUST
  mention the expected artifact path.
- Invalid artifact JSON or lowering failures MUST fail as module-resolution
  errors.

Postconditions:

- Authors can `import "./foo.uff"` once artifacts exist under the configured
  root; compile-then-import is the supported workflow for `.uff` modules.
- Checks SHOULD run a compile-then-import gate against workflow-produced `./bin`
  (see `cli-bootstrap-005`) before language modules switch imports.
