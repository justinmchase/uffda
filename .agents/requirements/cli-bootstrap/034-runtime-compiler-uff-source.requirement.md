---
id: cli-bootstrap-034
title: RuntimeCompiler module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements"
---

# RuntimeCompiler Uff Source

## Requirement

Preconditions:

- `uffda/uffda.lang` is authored as `.uff`.
- Std provides `flat` and `coalesce` for declaration list merge / optional
  parameters, plus generic `to_set`/`pluck`/`has`/`eq`/`when`/`not` for
  re-export classification in projection.

Expected behavior:

- `src/lang/uffda/runtime.compiler.uff` MUST export `UffdaRuntimeCompiler` and
  lower import/export/rule syntax objects via Over patterns and serializable
  projections (no Native).
- Re-export classification MUST be expressed in the `.uff` projection
  (`NormalizeModule` pipeline) using those generic std helpers.
- Compiling language `.uff` modules MUST emit ModuleDeclarations under `./bin/`
  via the compile pipeline (parse → previous published compiler → write).
  Resolver.import loads that JSON only — it MUST NOT call the runtime compiler
  again. There MUST be no post-compile finalize/seed rewrite of `./bin`.
- `runUffdaRuntimeCompiler` MUST load `./runtime.compiler.uff` through the
  module resolver, then run the `UffdaRuntimeCompiler` entry rule.
- No committed compiler JSON under `src/`.

Postconditions:

- `src/lang/uffda/` contains `.uff` + thin `.ts` host only.
- The TypeScript ModuleDeclaration twin is gone.
