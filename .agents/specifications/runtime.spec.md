# Runtime specification

This chapter indexes runtime-level contracts for execution, scope, and
evaluation semantics.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Runtime chapter structure

Each runtime subtopic should define:

- the runtime concern it governs;
- its required invariants;
- its interactions with pattern matching;
- its error and failure boundaries;
- its composition and extension intent;

## Runtime evaluation model

- Runtime evaluation in Uffda MUST be async-capable throughout pattern, rule,
  and expression execution.
- Runtime contracts MAY complete synchronously when no awaitable behavior is
  encountered, but synchronous completion MUST be treated as an optimization,
  not a separate semantic category.
- Runtime subtopics MUST define their behavior in terms of awaitable evaluation
  even when current implementations still expose synchronous entry points.
- Error normalization, memoization, and left-recursion handling MUST remain
  well-defined under awaitable evaluation.

## Subtopics

- [runtime scopes](./runtime/scopes.spec.md)
- [runtime left recursion](./runtime/left-recursion.spec.md)
