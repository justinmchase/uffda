---
id: uffda-language-syntax-005
title: Rule declarations and module ordering follow the Uffda syntax contracts
spec_ref: ".agents/specifications/languages/uffda-syntax.spec.md#module-ordering-and-separators; .agents/specifications/languages/uffda-syntax/rule-declarations.spec.md#core-rule-contracts"
---

# Rule Declarations and Module Ordering

## Requirement

Preconditions:

- A module is parsed by `UffdaLang`.

Expected behavior:

- Each rule declaration MUST have exactly one pattern body, and its projection
  MUST be optional.
- Imports MUST appear before rule declarations.
- Declarations MUST be separated by semicolons.
- The whole module source MUST be consumed.

Postconditions:

- Tests:
  `src/requirements/uffda-language-syntax/005-pattern-declaration-and-module-ordering.requirement.test.ts`.
