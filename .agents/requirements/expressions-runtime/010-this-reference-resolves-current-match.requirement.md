---
id: expressions-runtime-010
title: The reserved `this` reference resolves to the current successful MatchOk
spec_ref: ".agents/specifications/expressions/reference.spec.md#behavioral-expectations; .agents/specifications/expressions/invocation.spec.md#match-access"
---

# `this` Reference Resolves the Current Match

## Requirement

Preconditions:

- A reference expression named `this` evaluates against a successful `MatchOk`.

Expected behavior:

- The reference MUST resolve to the current `MatchOk` itself (not just its
  `value`), so member expressions can project match metadata, including its
  source span. Foundational components MUST NOT rely on span reads for
  provenance (see `.agents/specifications/runtime/value-provenance.spec.md`).
- Authors needing match metadata inside an invocation MUST pass `this`
  explicitly as an ordinary argument or project it via member access; the
  runtime MUST NOT implicitly inject the match into any callable's arguments.

Error behavior:

- Target and argument child-expression exceptions MUST propagate unchanged.
