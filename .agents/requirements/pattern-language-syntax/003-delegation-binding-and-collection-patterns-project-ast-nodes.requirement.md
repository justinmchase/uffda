---
id: pattern-language-syntax-003
title: Delegation, binding, and collection pattern forms project AST nodes
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#pattern-families; .agents/specifications/languages/pattern-syntax/grammar.spec.md#binding-and-repetition"
---

# Delegation, Binding, and Collection Patterns

## Requirement

Preconditions:

- A pattern body is parsed by `PatternLang`.

Expected behavior:

- A reference MUST project a `resolve` node naming its target, and its arguments
  MUST project nested pattern nodes. An escaped identifier MUST allow a keyword
  as a reference name.
- A capture MUST project a variable binding node.
- Postfix repetition MUST preserve its bounds.
- Membership and `between` MUST project collection and ordered-range nodes.
- `over` MUST project its keyed child patterns.
- A pipeline MUST project its steps in order.
- Canonical multiline authoring MUST compose alternatives, pipelines, and keyed
  forms.

Postconditions:

- Tests:
  `src/requirements/pattern-language-syntax/003-delegation-binding-and-collection-patterns-project-ast-nodes.requirement.test.ts`.
