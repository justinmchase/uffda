---
id: uffda-runtime-compilation-008
title: Native source compilation passes owned codec data between grammar executions
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#native-compiler-handoffs"
---

# Native compiler handoffs

## Requirement

Preconditions:

- The host invokes native source compilation with compiled UffdaLang and
  UffdaRuntimeCompiler declarations.

Expected behavior:

- Parser input, parser output and compiler output MUST cross arena boundaries
  through owned codec documents, not JSON serialization or conversion hooks.
- Native undefined fields MUST NOT be omitted or converted to null.
- Exported declaration data MUST remain valid after the language heap has
  collected or run another source compilation.
- Recovered or failed source MUST produce its source diagnostics rather than a
  successful declaration. A later valid compilation MUST remain usable.

Postconditions:

- Bootstrap still reads unmodified compiled declarations; no artifact rewriting
  or import-time lowering is introduced.
- Tests: `src/languages.rs`.
