---
id: uffda-language-syntax-001
title: UffdaLang is the declared entrypoint and consumes its whole input
spec_ref: ".agents/specifications/languages/uffda-syntax.spec.md#integration-contracts; .agents/specifications/languages/uffda-syntax/module-structure.spec.md#syntax-boundary"
---

# Entrypoint and Boundary

## Requirement

Preconditions:

- `src/lang/uffda/uffda.lang.uff` defines the Uffda language.

Expected behavior:

- The module MUST export a `UffdaLang` rule that tokenizes its source without
  whitespace tokens, matches a module body, and then requires the end of input.
- An empty source MUST parse cleanly as an empty module.
- A source with trailing input that is not a declaration MUST NOT parse cleanly.

Postconditions:

- Tests:
  `src/requirements/uffda-language-syntax/001-entrypoint-and-boundary.requirement.test.ts`.
