---
id: expressions-runtime-002
title: Async expression rejections normalize at the pattern-expression boundary
spec_ref: ".agents/specifications/expressions/runtime-semantics.spec.md#pattern-boundary-behavior; .agents/specifications/expressions/runtime-semantics.spec.md#exception-model"
---

# Async Expression Rejection Normalization

## Requirement

Preconditions:

- A rule pattern matches successfully and the rule has a projection expression.
- The projection expression evaluation rejects asynchronously.

Expected behavior:

- The runtime MUST convert the rejection at the pattern-expression boundary into
  a `MatchKind.Error` with `MatchErrorCode.ExpressionException`.
- The runtime MUST preserve the original throwable as boundary cause data.
- If the throwable is an `Error` instance, runtime diagnostics MUST preserve the
  original error object.

Postconditions:

- Rule evaluation reports deterministic runtime errors for asynchronous
  expression failures without leaking rejected promises past pattern evaluation.
