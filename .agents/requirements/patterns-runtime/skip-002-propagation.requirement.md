---
id: skip-002
title: Composite patterns omit or forward skipped children by one rule
spec_ref: ".agents/specifications/patterns/runtime/skip.spec.md#skipped-success-propagation"
---

# Skipped Success Propagation

## Requirement

Preconditions:

- A composite pattern evaluates a child whose outcome is a skipped success.

Expected behavior:

- `then` and `quantifier` MUST omit skipped children from their collected arrays
  and MUST report an ordinary success, including when every child was skipped
  (value `[]`). Skipped repetitions MUST count toward quantifier bounds.
- `or`, `resolve` (and rule invocation without a rule expression), `variable`,
  `maybe` (when its child matched), `and` (final child), `switch` (chosen case),
  `into`, and `pipeline` (final step) MUST report a skipped success.
- `variable` over a skipped child MUST bind `undefined`.
- `projection`, rule expressions, `not`, `except`, `lookahead`, and `over` MUST
  report an ordinary success (or, for `not`, failure) as their own contracts
  define; a skipped child counts as a child success.

Postconditions:

- `(string | skip)*` over `["a", 1, "b", 2]` MUST succeed with `["a", "b"]`.
- `[skip sep:string rest:string*] -> (join rest sep)` over
  `[[".", "a", "b", "c"]]` MUST succeed with `"a.b.c"`.
