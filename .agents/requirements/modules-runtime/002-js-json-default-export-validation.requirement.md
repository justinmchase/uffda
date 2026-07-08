---
id: modules-runtime-002
title: JavaScript and JSON declaration modules require default declaration exports
spec_ref: ".agents/specifications/modules.spec.md#javascript-and-typescript-declaration-modules; .agents/specifications/modules.spec.md#json-declaration-modules"
---

# JS and JSON Default Export Validation

## Requirement

Preconditions:

- Runtime module resolution imports a `.js` or `.json` declaration module.

Expected behavior:

- A valid declaration module MUST provide a default export containing a module
  declaration.

Error behavior:

- If a `.js` declaration module omits a default declaration export, resolution
  MUST fail with a module-resolution error.
- If a `.json` declaration module import/parsing fails, resolution MUST fail
  with a module-resolution error.

Postconditions:

- Invalid declaration modules do not produce partially successful resolution
  results.
