---
id: expressions-runtime-010
title: Match-aware invocation injects MatchOk before author arguments
spec_ref: ".agents/specifications/expressions/invocation.spec.md#match-aware-invocation"
---

# Match-Aware Invocation

## Requirement

Preconditions:

- An invocation expression evaluates a match-aware std callable (for example
  `match_leaf_offset`).
- Evaluation runs against a successful `MatchOk`.

Expected behavior:

- Invocation MUST call the target as `fn(match, ...evaluatedArgs)`.
- Authors MUST NOT supply the match value as an explicit argument.
- Non-match-aware callables MUST continue to receive only evaluated arguments.

Error behavior:

- Non-callable targets MUST throw an evaluation exception.
- Target and argument child-expression exceptions MUST propagate unchanged.
