---
id: switch-004
title: Switch propagates key resolution and character-class errors
spec_ref: ".agents/specifications/patterns/runtime/switch.spec.md#error-conditions"
---

# Switch Key Resolution Error Semantics

## Requirement

Preconditions:

- Switch pattern is evaluated at position P and a case key declares a value
  source (for example a contextual `$name` reference) or a character class.

Expected behavior:

- If resolving a case key's declared value source reports an error (such as an
  unbound `$name` reference), Switch MUST propagate that error immediately and
  MUST NOT continue checking subsequent case keys.
- If a case key declares a character class the runtime does not recognize,
  Switch MUST report an error rather than treating the key as non-matching.
- If a case key declares a character class and the current input item is not a
  string, Switch MUST report a type error (matching the standalone `character`
  pattern's error code and message) rather than treating the key as
  non-matching.

Postconditions:

- On key-resolution error, Switch MUST NOT evaluate any case body pattern.
