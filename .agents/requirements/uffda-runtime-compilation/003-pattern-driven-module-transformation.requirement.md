---
id: uffda-runtime-compilation-003
title: Compiler rules transform syntax declarations into runtime declarations
spec_ref: ".agents/specifications/languages/uffda-runtime-compilation.spec.md#compiler-language-contract"
---

# Pattern-driven Module Transformation

## Requirement

Preconditions:

- The compiler entry rule receives a valid `UffdaSyntaxModule` fixture.

Expected behavior:

- Compiler rules MUST select declaration variants through pattern matching.
- Declaration sequences MUST be transformed through rule and pattern
  composition.
- Compiler projections MUST construct runtime imports, exports, and rules while
  preserving their declared identities and observable order.

Postconditions:

- The successful match value MUST equal the expected runtime `ModuleDeclaration`
  for the complete input fixture.
