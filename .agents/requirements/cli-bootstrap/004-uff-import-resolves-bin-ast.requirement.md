---
id: cli-bootstrap-004
title: .uff imports resolve mirrored bin ModuleDeclaration artifacts
spec_ref: ".agents/specifications/modules.spec.md#uffda-source-imports-uff; .agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Uff Import Resolves Bin AST

## Requirement

Preconditions:

- An authored `.uff` source has been compiled into its artifacts in the
  resolver's artifact layout (default root: the working directory; default
  outDir: `./bin`), using the CLI path layout
  `<outDir>/ast/<path-from-root>.uff.ast` and
  `<outDir>/ast/<path-from-root>.uff.ast.json`.
- A module import names that source with a `.uff` URL (relative or absolute).

Expected behavior:

- Runtime resolution MUST remap the logical `.uff` URL to the mirrored artifact
  paths (prefer `.uff.ast`, else `.uff.ast.json`) and MUST NOT read the `.uff`
  source text.
- The runtime MUST load the chosen artifact as a ModuleDeclaration without
  re-lowering it or invoking the runtime compiler.
- Module identity and resolver cache keys MUST remain the logical `.uff` URL.
- Direct `.json` imports MUST resolve to their actual paths. Direct `.ts` and
  `.js` file imports MUST be rejected; explicit CLI `--ast` input remains
  supported.

Error behavior:

- A missing artifact MUST fail with `MatchErrorCode.ModuleResolution` and MUST
  mention the preferred `.uff.ast` path (and SHOULD mention the JSON fallback
  that was tried).
- A `.uff` module outside the layout's root MUST fail with
  `MatchErrorCode.ModuleResolution` naming the module and the root.
- Invalid artifact codec or JSON text, or invalid declarations, MUST fail as
  module-resolution errors.

Postconditions:

- Authors can `import "./foo.uff"` once artifacts exist in the layout;
  compile-then-import is the supported workflow for `.uff` modules.
- Checks SHOULD run a compile-then-import gate against workflow-produced `./bin`
  (see `cli-bootstrap-005`) before language modules switch imports.

## Test plan

- `rust/src/builtins.rs`, `rust/src/resolver.rs`,
  `rust/src/resolver/packages/tests.rs`, `rust/src/resolver/ported_tests.rs`,
  `rust/src/runtime/module_ports.rs`
