---
id: cli-bootstrap-037
title: Resolve and Structure modules have authored .uff source (B9)
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# Resolve / Structure Uff Source (B9)

## Requirement

Preconditions:

- `pattern/pattern` is authored as `.uff` and exports `Pattern`.
- `common/identifier` is authored as `.uff`.
- Std helpers `flat`, `coalesce`, `pack`, and `from_entries` are available at
  match time.

Expected behavior:

- `src/lang/pattern/resolve.uff` MUST export `Resolve` with serializable
  projections (no `ExpressionKind.Native`). Optional argument lists MUST use
  `(flat (coalesce … []))` rather than host unpack.
- `src/lang/pattern/structure.uff` MUST export `Structure` with Group and Over
  arms. Over keys MUST be built with `(from_entries …)` rather than
  `Object.fromEntries`.
- `src/lang/pattern/atomic.uff` MUST import `./resolve.uff` and
  `./structure.uff` (not the TypeScript twins).
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.
- The resolve/structure ↔ Pattern import cycle MUST remain (via Atomic);
  Resolver caching MUST prevent recursive re-import.

Postconditions:

- TypeScript twins `resolve.ts` / `structure.ts` are gone.
- Conversion-plan blocker B9 is closed; modules 29–30 are done.
- `builtInLanguageDeclarations` MUST NOT register resolve/structure.
