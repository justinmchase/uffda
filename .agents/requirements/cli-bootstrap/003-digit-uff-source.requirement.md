---
id: cli-bootstrap-003
title: Digit language module has authored .uff source
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#artifact-layout-requirements; .agents/specifications/languages/cli.spec.md#milestone-11-self-hosting-bootstrap"
---

# Digit Uff Source

## Requirement

Preconditions:

- Self-hosting begins by converting TypeScript language modules into `.uff`
  sources one module at a time.

Expected behavior:

- `src/lang/common/characters/digit.uff` MUST declare and export the `Digit`
  rule using Uffda source syntax.
- Compiling that file with the Uffda CLI MUST succeed and emit AST JSON under
  `./bin/`.

Postconditions:

- Digit is the first language-folder module replaced by authored `.uff` source.
- Dependents import `./digit.uff` (or equivalent); the TypeScript twin is gone.
- Runtime loads Digit from `./bin` via `.uff` remapping (not
  `builtInLanguageDeclarations`).
