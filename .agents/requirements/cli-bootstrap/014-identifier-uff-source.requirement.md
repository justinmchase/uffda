---
id: cli-bootstrap-014
title: Identifier language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# Identifier Uff Source

## Requirement

Preconditions:

- Phase 0 character leaves that Identifier imports are converted to `.uff`.
- Runtime std provides `flat` and `join` for serializable projections (B2).

Expected behavior:

- `src/lang/common/identifier.uff` MUST declare and export `Identifier` with
  projection `(join (flat _) "")`, with no Native projection.
- It MUST also export `IdToken` as `string & [Identifier]` for token-stream
  identifier matching (PatternLang / ExpressionLang). Uffda’s `IdentifierToken`
  remains separate and MAY compose `IdToken` with reserved- keyword exclusion.
- Compiling that file with the bootstrap compile path MUST succeed and emit AST
  JSON under `./bin/`.

Postconditions:

- Identifier is converted as a Phase 1 common helper.
- Dependents import `../common/identifier.uff`; the TypeScript twin is gone.
- Runtime loads Identifier from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
