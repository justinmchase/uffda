---
id: modules-runtime-003
title: Native import declarations provide module declarations for normal import binding
spec_ref: ".agents/specifications/modules.spec.md#native-declaration-imports; .agents/specifications/modules.spec.md#resolution-flow"
---

# Native Import Declaration Resolution

## Requirement

Preconditions:

- A module declaration contains a native import declaration with module names
  and a declaration payload.

Expected behavior:

- Native import declarations MUST be converted to declaration entries before
  normal imported-name binding.
- Imported names listed in the native import declaration MUST bind from the
  resolved module declaration exports.

Error behavior:

- Unknown imported names from the resolved native declaration MUST fail with a
  module-resolution error.

Postconditions:

- Native declaration imports participate in the same visibility and import
  binding semantics as module-based imports.
