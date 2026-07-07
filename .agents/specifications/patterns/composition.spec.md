# Composition as building blocks

This chapter defines the top-level contract for combining smaller patterns into
larger matching structures.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../patterns.spec.md#conventions).

## Logical purpose

Pattern composition allows a grammar author to build larger recognizers from
smaller, focused pattern units. Composition is the mechanism by which Uffda
expresses sequencing, choice, predicates, traversal, binding, and other
higher-order matching behavior.

## Composition model

- A composed pattern MUST define its behavior in terms of one or more child
  patterns, delegated evaluations, or both.
- A composed pattern MUST evaluate child patterns against a well-defined
  matching context derived from the caller-visible context.
- A composed pattern MAY transform child outputs into a new output value, but it
  MUST do so without changing the success, failure, error, or left-recursion
  meaning of child outcomes except where that pattern's own chapter explicitly
  defines such a transformation.
- A composed pattern MUST remain composable with any other pattern that obeys
  the contracts in this specification and the runtime chapter.
- Composed pattern evaluation MUST be async-capable.

## Behavioral expectations

- Pattern composition MUST be closed under nesting: any pattern that can appear
  at a rule boundary MAY appear as a child within another composed pattern
  unless a specific pattern chapter states otherwise.
- A composed pattern MUST define the order in which its children are evaluated.
- A composed pattern MUST define whether later child evaluation depends on
  earlier child outcomes.
- If child evaluation is awaitable, the composed pattern MUST preserve the same
  logical evaluation order across awaited continuations.
- If a composed pattern delegates to a child pattern and that child reports an
  error, the composed pattern MUST propagate the error unless the child
  pattern's chapter explicitly defines a different error contract.
- If a composed pattern delegates to a child pattern and that child reports a
  left-recursion outcome, the composed pattern MUST propagate that outcome
  unchanged unless the composed pattern's chapter explicitly defines stricter
  left-recursion handling consistent with
  [runtime left recursion](../runtime/left-recursion.spec.md).

## Input consumption and backtracking invariants

- A composed pattern MUST consume input only through successful delegated child
  evaluation or through success semantics explicitly defined by that pattern's
  own chapter.
- If a composed pattern succeeds, the caller-visible input position MUST advance
  exactly as defined by the successful child evaluations that contribute to that
  success.
- If a composed pattern fails, it MUST report failure from the original
  caller-visible input position unless the pattern's own chapter explicitly
  defines a committing or error-producing boundary.
- Branch-local exploratory evaluation MUST NOT leak consumed input from a
  failing branch into sibling branches or caller-visible failure results.
- A zero-width composed pattern MUST leave the caller-visible input position
  unchanged on both success and failure.
- Awaitable child evaluation MUST NOT weaken backtracking or position
  preservation guarantees.

## Matching context and scope propagation

- A composed pattern MUST evaluate within a matching context that includes the
  current input position and the active runtime scope.
- If a child pattern produces bindings, captures, or other scope-visible state,
  the enclosing composed pattern MUST expose that state only according to the
  success semantics of the enclosing composition.
- Scope-visible effects produced only by a failing exploratory branch MUST NOT
  become observable after that branch fails.
- Composition rules that rely on scope mutation or variable binding MUST remain
  consistent with [runtime scopes](../runtime/scopes.spec.md).
- Awaited child continuations MUST preserve the same caller-visible scope
  isolation as immediate child evaluation.

## Output composition

- A composed pattern MAY return one child value, multiple child values, a
  transformed value, or no value, depending on its own chapter.
- A composed pattern MUST define how successful child outputs contribute to its
  own output.
- Failure output and error output MUST remain distinguishable from successful
  output values.
- A composed pattern MUST NOT require callers to infer success or failure from
  output shape alone.
- Awaitable child outputs MUST compose into the same logical output shape as
  their immediate counterparts.

## Common composition roles

The runtime pattern set includes several recurring composition roles:

- sequencing, where later evaluation depends on earlier success;
- alternation, where one of several branches may satisfy the match;
- predicates, where child outcomes are observed without consuming input;
- traversal and boundary patterns, where child evaluation is repositioned or
  constrained relative to the current input surface;
- binding and transformation patterns, where child matches contribute named or
  computed outputs.

These roles are refined by the runtime pattern subtopics indexed in
[runtime patterns](./runtime-patterns.spec.md).

## Relationship to rule structure

- Composition SHOULD be the primary way grammar authors express larger rule
  structure from reusable units.
- Nested composition SHOULD preserve local reasoning: a reader should be able to
  understand a composite pattern from the contracts of its immediate pattern
  forms and children.
- Composition MAY be used to encode precedence, associativity, guards,
  repetition, and structural descent without requiring a distinct grammar
  formalism for each concern.

## Left-recursion interactions

- Composition MUST NOT reinterpret unsupported indirect left recursion as
  ordinary failure.
- Composition forms that delegate into recursive rules MUST follow the runtime
  left-recursion contract defined in
  [runtime left recursion](../runtime/left-recursion.spec.md).
- Composition forms that are commonly used to express direct left recursion,
  especially ordered choice and sequencing, SHOULD document any stricter local
  expectations in their own chapters.
- Async-capable composition MUST preserve left-recursion detection and outcome
  propagation semantics.

## Composition intent

- This chapter is intended to define shared invariants across composite pattern
  forms rather than to replace the behavior of specific runtime patterns.
- Requirement authors SHOULD derive narrower expectations for individual
  patterns from both this chapter and the relevant runtime pattern chapter.
- New composite pattern forms SHOULD align with this chapter before adding
  pattern-specific semantics.
- Implementations SHOULD optimize synchronous fast paths, but composition
  semantics are defined in the async-capable model.
