# External host execution

This chapter defines executor-independent suspension of expression calls to
explicitly registered host callables. It complements
[memory management](memory-management.spec.md). Its scope includes expression
parameter patterns, pattern projections and iterable drains, and runtime rule
execution. Asynchronous input sources and module loading are separate concerns.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are interpreted as
described in RFC 2119 and RFC 8174 when they appear in all capitals.

## Definitions

- A host callable is a callable value with explicit host identity and callable
  metadata, registered in an ordinary environment.
- A host request owns rooted arguments and identifies one pending invocation.
- A completion is either a retained runtime value, a materializer that
  constructs a runtime value upon safe arena re-entry, or a host error.

## Axioms

- Language values MUST NOT include Promises or host futures.
- Native kernel functions MUST remain pure and executor-independent.
- Authored and immediate native calls MUST NOT be classified as asynchronous
  merely because they are callable.
- Collector pointers and collector lifetimes MUST NOT escape mutation scopes.

## Constraints

- Suspension MUST retain the continuation and all arguments across collection.
- A request MUST be completed only once, in its originating execution; foreign
  roots and stale completions MUST fail explicitly.
- Results MUST NOT be limited to JSON or scalar values. Retained composite
  identity MUST be preserved, and materializers MAY construct arbitrary values.
- Host futures MUST be polled outside collector mutation and borrow scopes.
- Errors MUST become sticky execution failures and preserve ordinary rule and
  conversion error behavior.
- Cancellation and abandonment MUST release request arguments, continuation
  roots, and the pending future once their owners are dropped.

## Mechanism

Ordinary call dispatch creates an external request for a host callable.
Subsequent steps report suspension without progressing children. Hosts MAY
service the request directly or use an executor-independent future driver.
Completion re-enters the originating arena before installing the result.
Composite children and successive host calls MUST execute in source order.
Cooperative driver yields MUST arrange a wake before returning pending.

Pattern and rule execution MUST forward a suspended child's host request to its
owning evaluator, without treating it as a rule-resolution request. They MUST
resume that same child before progressing siblings, finishing a rule, or
committing its memoized result. Roots within one owning arena MUST remain
readable after a child completes. Cancellation and host errors MUST release
temporary frames, initialization arguments, and pending memo dependencies.

## Why this design

Explicit callable values avoid hidden global protocols. Rooted requests and
re-entry materializers allow futures to retain rich values without exporting
collector lifetimes. Keeping the executor outside evaluation preserves immediate
execution and lets hosts choose their own executor.
