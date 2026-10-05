---
id: pattern-language-syntax-002
title: Composition and grouping pattern forms project AST nodes
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#precedence; .agents/specifications/languages/pattern-syntax.spec.md#composition-operator-policy"
---

# Composition and Grouping Patterns

## Requirement

Preconditions:

- A pattern body is parsed by `PatternLang` with full input consumption.

Expected behavior:

- `!` MUST project a unary `not` node.
- `|` MUST project an `or` node that keeps its alternatives in source order.
- `&` MUST bind tighter than `|`.
- A leading `|` MUST be accepted, so alternatives can be aligned one per line.
- The keywords `and` and `or` MUST NOT be accepted as composition operators.
- Parentheses MUST preserve the grouped pattern as the nested value.
- A bracketed child pattern MUST project an `into` node.
- Grouping MUST be able to wrap pipelines and lower-precedence children.

Postconditions:

- Tests:
  `src/requirements/pattern-language-syntax/002-composition-and-grouping-patterns-project-ast-nodes.requirement.test.ts`.
