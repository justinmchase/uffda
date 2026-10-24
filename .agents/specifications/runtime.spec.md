# Runtime specification

This chapter indexes runtime-level contracts for execution, scope, and
evaluation semantics.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Runtime chapter structure

Related contracts:

- [Lossless strings](./runtime/strings.spec.md)
- [Host execution](./runtime/host-execution.spec.md)
- [Asynchronous input](./runtime/async-input.spec.md)

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
- In the Rust runtime, pending work MUST be execution state, not a first-class
  Promise/Future language value. Completed invocation results MUST be ordinary
  values, independent of whether the callable is native or authored.
- Rust execution MUST distinguish completed work, external suspension and
  cooperative yielding. Host futures MAY drive suspension outside the collector;
  GC mutation contexts and borrowed objects MUST NOT cross an await boundary.
- Pending execution MUST NOT be serialized as an empty object, undefined or a
  placeholder. Cancellation and errors MUST release temporary roots.

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
- The retired TypeScript host adapter adopted thenables according to that host's
  await behavior. Rust MUST NOT infer suspension by inspecting a data object's
  `then` property; host operations use explicit execution requests.
- Composites that evaluate children in sequence (`Then`, `And`, `Or`, `Over`,
  `Quantifier`, and sequential expression lists) MUST evaluate each child only
  after the previous child has completed, in declared order, whether earlier
  children completed synchronously or asynchronously. The outcome, the consumed
  input, and the bindings MUST be identical in both cases.
- Errors MUST be normalized identically whether an expression throws
  synchronously or rejects asynchronously. Cleanup obligations (such as leaving
  a memo frame) MUST run on success, synchronous throw, and rejection alike.
- **Rule boundary.** Fresh rule evaluation MUST bound host stack growth
  independently of input depth. The TypeScript host schedules a new task or
  microtask at fresh rule boundaries. Rust MAY use explicit continuation frames
  instead; authored rules MUST NOT be classified as asynchronous solely to
  achieve stack safety. Memoized results MAY complete immediately.
- Top-level TypeScript entry points continue to return promises. Rust entry
  points MAY expose resumable execution and synchronous/asynchronous host
  drivers with identical resolved outcomes.
- Explicit Rust JSON hooks and iterator factories MUST invoke native and
  authored callables through the same scheduler and consume their completed
  results. Hook errors and actual external suspension MUST follow ordinary
  execution behavior, not JavaScript Promise serialization/protocol accidents.

## Callable conversion

- Implicit text conversion MUST accept scalar values only: strings, numbers,
  booleans, null, undefined, bigint and symbols. Objects, arrays and callables
  MUST fail with an explicit error, even if they have text-conversion hooks.
  This applies to interpolation, positional formatting and scalar conversion
  within functions such as `join` and `int`.
- Callers MUST format composite values explicitly, for example by selecting
  fields, joining scalar elements, constructing strings, or requesting JSON.
- Explicit JSON serialization MUST continue to support data objects and arrays,
  but MUST reject callable values, including callable array elements and object
  properties. It MUST NOT expose implementation source, silently omit a callable
  property, or substitute `null`.
- A callable's conversion hooks MUST NOT make it serializable. Non-callable
  objects MAY retain JSON hooks, but a hook returning a callable MUST fail.
- Explicit callable metadata access remains supported. Implementation-source
  reflection and implicit composite/callable `toString` are not runtime
  capabilities.

## Subtopics

- [runtime memory management](./runtime/memory-management.spec.md)
- [runtime scopes](./runtime/scopes.spec.md)
- [runtime rules](./runtime/rules.spec.md)
- [runtime left recursion](./runtime/left-recursion.spec.md)
- [match diagnostics](./runtime/match-diagnostics.spec.md)
- [runtime incremental re-parsing](./runtime/incremental-parsing.spec.md)
- [runtime error recovery](./runtime/error-recovery.spec.md)
- [runtime memo eviction](./runtime/memo-eviction.spec.md)
- [runtime selective memoization](./runtime/selective-memoization.spec.md)
- [runtime compiled pattern dispatch](./runtime/compiled-patterns.spec.md)
- [runtime rule metadata](./runtime/rule-metadata.spec.md)
- [runtime value metadata](./runtime/value-metadata.spec.md)
- [runtime value provenance](./runtime/value-provenance.spec.md) (proposed)
