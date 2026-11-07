---
id: pattern-language-syntax-012
title: Object pattern keys bind implicitly and alias with as
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#object-patterns; .agents/specifications/languages/pattern-syntax/grammar.spec.md#binding-and-repetition"
---

# Object Key Captures

## Requirement

Preconditions:

- A pattern body containing an object pattern is parsed by `PatternLang`.

Expected behavior:

- `{ n: number }` MUST look up key `n`, match `number`, and bind `n`.
- `{ n }` MUST parse as `{ n: any }` and bind `n`.
- `{ n: number as x }` MUST match `number` at key `n` and bind only `x`.
- `{ n as x }` MUST match `any` at key `n` and bind only `x`.
- `{ kind: "Ping", n: number }` MUST bind both `kind` and `n`.
- `{ n: n }` MUST mean key `n` matching rule `n`, not `any`.
- `{ n: n: number }` MUST fail to parse (ungrouped capture as a field value).
- `{ n: number as x, m: number as x }` MUST fail because `x` is bound twice.
- `{ a: { x: number as ax }, b: { x: number as bx } }` MUST bind `a`, `b`, `ax`,
  and `bx`. Nested same-name captures without `as` are an error on one matching
  path; a later pass MAY tighten the grammar walk that reports them.

Postconditions:

- Each named entry normalizes to a `variable` wrapping the field pattern, with
  `name` equal to the key or the `as` alias.
- In-tree Uffda grammars MAY keep `{ field: x:P }` until PatternLang with this
  syntax is the embedded compiler; a follow-up migrates those sources to `as`.
- Tests: `src/lang_tests/pattern.rs`
  (`structure_object_keys`, `pattern_lang_object`,
  `structure_binds_bare_object_key`, `structure_binds_typed_object_key`,
  `structure_aliases_object_key_with_as`, `structure_rejects_ungrouped_field_capture`,
  `structure_rejects_duplicate_aliases`,
  `structure_aliases_nested_duplicate_fields`,
  `pattern_lang_binds_ping_object`).
