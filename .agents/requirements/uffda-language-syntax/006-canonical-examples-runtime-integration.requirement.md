---
id: uffda-language-syntax-006
title: The canonical Uffda examples parse, compile, and execute
spec_ref: ".agents/specifications/languages/uffda-syntax/canonical-examples.spec.md#contracts"
---

# Canonical Examples Execute

## Requirement

Preconditions:

- The canonical examples in the spec chapter.

Expected behavior:

- The identity example (`export Main; rule Main = any;`) MUST parse through
  `UffdaLang`, compile, and execute end to end.
- The projection example (`export One; rule One = any -> 1;`) MUST parse,
  compile, and execute, producing its projected value.

Postconditions:

- Tests:
  `src/requirements/uffda-language-syntax/006-canonical-examples-runtime-integration.requirement.test.ts`.
