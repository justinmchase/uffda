# Expression language

This chapter defines the language-level intent and constraints for author-facing
expression syntax.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Language intent

- The language SHOULD remain intentionally simple.
- The language SHOULD prioritize composability, metaprogramming, and code
  generation over broad syntactic sugar.
- New surface syntax SHOULD be added only when it clarifies semantics that are
  already difficult to express using existing expression forms.

## Sandboxing and capability model

- Expression evaluation MUST be sandboxed.
- Expressions MUST resolve values only through runtime scope and explicitly
  configured runtime capabilities.
- Expressions MUST NOT implicitly expose ambient JavaScript globals.
- The standard library MAY be exposed to expressions only through explicit
  runtime context injection.
- Expression failures MUST use thrown exceptions rather than pattern-style
  raised error outcomes.

## Async execution direction

- The language currently has no dedicated `async`/`await`/promise syntax.
- Async behavior is a runtime execution concern, not a syntax concern.
- Expressions are async-capable by default.
- Invocation, lambda execution, and native host interop MUST follow the
  propagation rules defined in
  [expression runtime semantics](./runtime-semantics.spec.md).

## Open questions and recommendations

- Question: Should pattern evaluation remain synchronous if expression
  evaluation becomes async-by-default? Recommendation: Define an explicit
  boundary chapter describing allowed sync/async crossings and whether pattern
  engines can invoke async expressions without changing pattern match
  determinism.

## Language decisions

- Unresolved references MUST throw a reference exception.
- Expression semantics use thrown exceptions; they do not raise pattern-error
  outcomes directly.
