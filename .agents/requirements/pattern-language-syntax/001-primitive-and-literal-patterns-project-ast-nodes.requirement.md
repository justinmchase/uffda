---
id: pattern-language-syntax-001
title: Primitive and literal pattern forms project AST nodes
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#pattern-families"
---

# Primitive and Literal Patterns

## Requirement

Preconditions:

- A pattern body is parsed by `PatternLang`.

Expected behavior:

- `any` MUST project an `any` pattern node.
- A literal value MUST project an `equal` node holding that value.
- A type keyword MUST project a `type` node naming that type.
- A character class MUST project a character-class node.

Postconditions:

- Tests:
  `src/requirements/pattern-language-syntax/001-primitive-and-literal-patterns-project-ast-nodes.requirement.test.ts`.
