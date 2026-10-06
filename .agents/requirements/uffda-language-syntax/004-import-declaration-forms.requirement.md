---
id: uffda-language-syntax-004
title: Import declarations cover no imports, several modules, repeated modules, and several names
spec_ref: ".agents/specifications/languages/uffda-syntax/imports.spec.md#core-contracts"
---

# Import Declaration Forms

## Requirement

Preconditions:

- A module is parsed by `UffdaLang`.

Expected behavior:

- A module MAY contain no imports.
- A module MAY import from several different modules, and MAY import the same
  module more than once.
- One import declaration MUST accept one or more imported names, separated by
  whitespace rather than commas.

Postconditions:

- Tests:
  `src/requirements/uffda-language-syntax/004-import-declaration-forms.requirement.test.ts`.
