---
id: error-recovery-009
title: The built-in grammars recover declarations, pattern tokens, and expression tokens
spec_ref: ".agents/specifications/languages/uffda-syntax/module-structure.spec.md#error-recovery; .agents/specifications/languages/pattern-syntax/grammar.spec.md#recovery-points; .agents/specifications/languages/expression-layer.spec.md#recovery-points"
---

# Built-in Grammar Recovery Points

## Requirement

Preconditions:

- Source parsed with a built-in language (Uffda, pattern, or expression).

Expected behavior:

- A source the grammar accepts MUST parse cleanly (a success that is not
  recovered).
- A Uffda declaration that fails to parse MUST be skipped through its `;`,
  stopping before a reserved declaration keyword, and every other declaration
  MUST still appear in the syntax tree. A broken import MUST NOT cause later
  valid imports to be skipped.
- A declaration missing its `;` MUST NOT absorb the rule, func, or decorator
  declaration after it.
- A stray token inside a pattern sequence, an invocation's arguments, or an
  array's elements, a broken object entry, and tokens left over after a complete
  pattern or expression MUST each be skipped as one recovery, keeping the
  surrounding declaration.
- Every recovery MUST contribute nothing to the syntax tree.

Postconditions:

- Hosts report one diagnostic per skipped region (see
  [error-recovery-008](./008-recovery-diagnostics.requirement.md)).

## Test plan

`src/lang_tests/uffda.rs` ("recovery points"),
`src/lang_tests/pattern.rs` (`then_recovers_a_stray_token`,
`pattern_lang_recovers_trailing_input`), `src/lang_tests/expression.rs`,
`src/lang_tests/common.rs`
(`recovery_phase_skips_one_unexpected_item_and_keeps_the_rest`).
