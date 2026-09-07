---
id: cli-bootstrap-025
title: SharedRules, Number, and Member modules have authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/uff-module-conversion-plan.md"
---

# SharedRules / Number / Member Uff Sources

## Requirement

Preconditions:

- `common/identifier`, `common/characters/digit`, and expression leaves used by
  Member targets are converted.
- Std provides `int` and `memberChain` for serializable projections.

Expected behavior:

- `src/lang/uffda/shared.rules.uff` MUST export `IdentifierToken` as
  `string & (not ReservedKeywordToken) & [Identifier]` and
  `ReservedKeywordToken` as `import|export|rule`.
- `src/lang/expression/number.uff` MUST export `Number` as
  `string & [Digit+] -> { kind: "number", value: (int (join (flat _) "")) }`.
- `src/lang/expression/member.uff` MUST export `Member` as
  `b:Token<MemberTarget> s:MemberTail+ -> (memberChain b s)`.
- Compiling those files with the bootstrap compile path MUST succeed and emit
  AST JSON under `./bin/`.

Postconditions:

- Dependents import the `.uff` URLs; TypeScript twins are gone.
- Runtime loads them from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
- `expression/string` remains TypeScript until PatternLang can combine `"\\"`
  patterns with object/string projections in one module (B13 family).
