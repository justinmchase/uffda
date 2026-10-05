---
id: uffda-language-syntax-002
title: Rule bodies are parsed by PatternLang and projections by ExpressionLang
spec_ref: ".agents/specifications/languages/uffda-syntax.spec.md#integration-contracts"
---

# Pattern and Expression Integration

## Requirement

Preconditions:

- A module declares a rule with a pattern body and a projection.

Expected behavior:

- The rule's pattern body MUST be parsed by `PatternLang`.
- The rule's projection MUST be parsed by `ExpressionLang`, producing expression
  nodes such as native invocations.

Postconditions:

- Tests:
  `src/requirements/uffda-language-syntax/002-integrates-pattern-and-expression-languages.requirement.test.ts`.
