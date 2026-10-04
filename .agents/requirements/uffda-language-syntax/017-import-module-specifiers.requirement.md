---
id: uffda-language-syntax-017
title: Import module specifiers are parsed by the grammar
spec_ref: ".agents/specifications/languages/uffda-syntax/imports.spec.md#module-specifiers"
---

# Import Module Specifiers

Refines
[module specifiers](../../specifications/languages/uffda-syntax/imports.spec.md#module-specifiers).

## Requirement

Preconditions:

- A Uffda module with an import declaration whose quoted text is a module
  specifier, or is not one.

Expected behavior:

- Relative paths (`"./tokens.uff"`, `"../common/identifier.uff"`), module names
  (`"@acme/kv"`, `"@acme/kv/tokens"`), and `jsr:` specifiers (`"jsr:@acme/kv"`,
  `"jsr:@acme/kv@^1.2.0/tokens"`) MUST parse cleanly, and the import's
  `moduleUrl` MUST be the specifier text exactly as written.
- A segment MAY begin with `.` (`"./.hidden.uff"`) but MUST NOT be `.` or `..`
  on its own outside the leading relative prefix.
- Empty text, bare names, absolute paths, backslashes, other URL schemes,
  whitespace, non-ASCII characters, empty segments, and a `jsr:` specifier
  missing its scope, package name, or version range after `@` MUST be syntax
  errors.
- The diagnostic for an invalid specifier MUST point at the offset where it
  stops being a specifier, explaining the expected form.

Postconditions:

- `src/requirements/uffda-language-syntax/017-import-module-specifiers.requirement.test.ts`
  covers the accepted and rejected forms, and
  `src/lang/uffda/specifier.rules.test.ts` covers each form's explanation.
