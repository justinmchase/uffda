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

## Synchronous completion and the rule boundary

- Pattern matching and expression evaluation MUST complete synchronously when
  every value they depend on is immediately available, and MUST return an
  awaitable only when a genuinely awaitable value (for example an async-iterable
  input or a native function returning a thenable) was encountered. A composite
  whose children all complete synchronously MUST itself complete synchronously.
- Whether an evaluation step is awaitable MUST be decided solely from the values
  its children actually produce at run time. Implementations MUST NOT classify
  patterns, expressions, or rules as synchronous or asynchronous ahead of time
  (by inspecting their structure, marking them, or compiling separate
  synchronous and asynchronous variants).
- Any thenable (an object with a callable `then`) MUST be treated as awaitable,
  matching the adoption behavior of `await`.
- Composites that evaluate children in sequence (`Then`, `And`, `Or`, `Over`,
  `Quantifier`, and sequential expression lists) MUST evaluate each child only
  after the previous child has completed, in declared order, whether earlier
  children completed synchronously or asynchronously. The outcome, the consumed
  input, and the bindings MUST be identical in both cases.
- Errors MUST be normalized identically whether an expression throws
  synchronously or rejects asynchronously. Cleanup obligations (such as leaving
  a memo frame) MUST run on success, synchronous throw, and rejection alike.
- **Rule boundary.** Every fresh (non-memoized) rule body evaluation MUST begin
  asynchronously, on a new task or microtask, so that the host call stack holds
  at most the patterns of one rule body at a time. Grammar recursion only
  happens through rules, so this bounds host stack depth independently of how
  deeply the input nests. Memoized rule results MAY be returned synchronously
  since they do not re-enter evaluation.
- Top-level entry points (grammar execution, module resolution/import) MUST
  continue to return promises.

## Subtopics

- [runtime scopes](./runtime/scopes.spec.md)
- [runtime rules](./runtime/rules.spec.md)
- [runtime left recursion](./runtime/left-recursion.spec.md)
- [match diagnostics](./runtime/match-diagnostics.spec.md)
- [runtime incremental re-parsing](./runtime/incremental-parsing.spec.md)
- [runtime memo eviction](./runtime/memo-eviction.spec.md)
- [runtime selective memoization](./runtime/selective-memoization.spec.md)
- [runtime compiled pattern dispatch](./runtime/compiled-patterns.spec.md)
- [runtime rule metadata](./runtime/rule-metadata.spec.md)
- [runtime value metadata](./runtime/value-metadata.spec.md)
