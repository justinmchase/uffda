# Pattern matching

This chapter defines the top-level runtime contract for evaluating patterns
against input.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../patterns.spec.md#conventions).

## Logical purpose

Pattern matching is the process by which a pattern is evaluated against the
current runtime scope and input position to determine whether it recognizes the
current input according to the pattern's declared semantics. At the
language-design level, pattern matching is also the primary branching and
binding mechanism; expression-layer conditionals are not the default way to
express that behavior.

Pattern-based branching MAY be invoked from projection contexts through a native
`match` function so patterns can act like callable dynamic constraints.

## Matching model

- Pattern matching MUST evaluate a pattern against an active runtime scope.
- Pattern matching MUST interpret the current scope's input position according
  to the [input model](./input-model.spec.md).
- Pattern matching MUST produce exactly one outcome for each pattern evaluation.
- Pattern matching MUST allow patterns to be nested, delegated, and composed as
  described in [composition as building blocks](./composition.spec.md).
- Pattern matching MUST be async-capable.
- A pattern evaluation MAY complete immediately or await child evaluation, but
  both cases MUST obey the same semantic contracts.

## Outcome categories

Pattern matching outcomes fall into four categories:

- success, where the pattern recognizes the input according to its contract;
- failure, where the pattern does not recognize the input but no runtime error
  has occurred;
- error, where evaluation cannot continue according to the runtime contract;
- left-recursion outcome, where evaluation must be routed through the runtime
  left-recursion mechanism instead of being interpreted as ordinary success or
  failure.

- A pattern evaluation MUST produce an outcome that is distinguishable among
  these categories.
- Failure MUST remain semantically distinct from error.
- Left-recursion handling MUST remain semantically distinct from ordinary
  success and failure.

## Success semantics

- When a pattern succeeds, it MUST report a resulting scope.
- A successful pattern MAY consume input, produce output, produce bindings, or
  leave one or more of those dimensions unchanged, depending on the pattern's
  own contract.
- A successful pattern MUST report its output in a form that is distinguishable
  from failure output.
- A successful zero-width pattern MUST preserve the caller-visible input
  position.
- Awaiting successful child evaluation MUST NOT change the logical success
  semantics of the enclosing pattern.

## Failure semantics

- Failure MUST indicate that the pattern did not match under normal runtime
  conditions.
- A failed pattern MUST NOT by itself imply a runtime defect.
- A failed pattern MUST preserve the caller-visible input position unless the
  governing pattern chapter explicitly defines a stronger boundary contract.
- A failed pattern MUST NOT expose bindings or scope-visible effects that were
  produced only during exploratory evaluation of the failing path.
- Awaitable branch evaluation that ultimately fails MUST preserve the same
  caller-visible failure invariants as immediate failure.

## Error semantics

- Error MUST indicate that evaluation encountered a condition that the runtime
  does not treat as ordinary non-match behavior.
- Errors MUST be propagated according to the evaluating pattern's contract.
- Errors MUST NOT be silently downgraded to ordinary failure unless a specific
  pattern chapter explicitly defines that behavior.
- Thrown exceptions and async rejections from runtime-integrated evaluation
  steps MUST be normalized into runtime error outcomes at defined pattern or
  rule boundaries.

## Input-position invariants

- Pattern matching MUST occur at a specific input position in the active input
  stream.
- Input-consuming patterns MUST advance the resulting input position exactly as
  defined by their pattern contracts.
- Zero-width patterns MUST leave the resulting input position unchanged.
- End-of-input MUST be treated as a normal matching condition that patterns may
  inspect and react to by success or failure according to their own contracts.
- Pattern matching over a single-item scalar stream MUST still obey the same
  position and end-of-input invariants as matching over multi-item streams.

## Non-string matching surfaces

- Pattern matching MUST NOT be limited to string characters.
- The runtime MUST support matching over ordered streams of arbitrary JavaScript
  values after normalization at pattern-entry boundaries.
- A scalar value MUST be matchable as one input item.
- Iterable values MAY be matched as streams of items when iterable normalization
  is selected.
- Objects, maps, arrays, strings, and other JavaScript values MAY participate in
  matching according to the input-surface and traversal rules defined by the
  relevant pattern chapters.

## Scope interactions

- Pattern matching MUST use the active runtime scope as the source of input
  position, visible rules, visible variables, and runtime options.
- Successful evaluation MUST project any resulting input position and visible
  bindings through the resulting scope.
- Failed evaluation MUST preserve caller-visible scope invariants as defined in
  [runtime scopes](../runtime/scopes.spec.md#scope-transitions-during-pattern-matching).
- Pattern matching that delegates to referenced rules MUST use scope-based rule
  resolution.
- Awaitable child evaluation MUST preserve scope projection order and caller-
  visible scope boundaries.

## Composition and delegation

- Pattern matching MUST support delegation from one pattern to another without
  losing the distinction between success, failure, error, and left-recursion
  outcomes.
- Composite patterns MUST define how child outcomes contribute to the enclosing
  outcome.
- Branch-local exploratory evaluation MUST NOT leak consumed input or temporary
  bindings across failure boundaries.
- Delegation semantics MUST remain coherent whether child evaluation completes
  immediately or via awaitable continuation.

## Left-recursion interactions

- Pattern matching MUST route direct left recursion through the runtime
  mechanism defined in
  [runtime left recursion](../runtime/left-recursion.spec.md).
- Pattern matching MUST NOT claim general support for indirect left recursion
  beyond what the runtime chapter allows.
- A left-recursion outcome MUST NOT be reinterpreted as ordinary failure by a
  delegating pattern unless that behavior is explicitly defined and remains
  consistent with the runtime chapter.

## Composition intent

- This chapter defines shared matching semantics for all runtime patterns.
- Individual runtime pattern chapters SHOULD refine this chapter with
  pattern-specific consumption, output, and delegation rules.
- Requirement authors SHOULD derive low-level matching assertions from this
  chapter together with the relevant pattern-specific chapter and runtime
  chapter.
- Implementations SHOULD optimize for synchronous completion where possible, but
  the normative contract is the async-capable model.
