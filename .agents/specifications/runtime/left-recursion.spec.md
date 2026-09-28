# Runtime left recursion

This chapter defines the runtime contract for direct, indirect, and mutual left
recursion in Uffda pattern matching.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Runtime left-recursion handling allows natural left-associative grammar
definitions without requiring grammar authors to manually rewrite rules into
non-left-recursive forms, whether the recursion returns to a rule directly or
through other rules.

## Definitions

- A rule **invocation** is identified by its rule, its resolved rule arguments,
  and its input position: the same identity that keys packrat memoization (see
  [runtime rules](./rules.spec.md)).
- A **left-recursive cycle** occurs when an invocation is re-entered while it is
  still in progress, at the same input position.
- Direct left recursion (DLR) is a left-recursive cycle in which the invocation
  re-enters itself without passing through another rule invocation.
- Indirect left recursion (ILR) is a left-recursive cycle that passes through
  one or more other rule invocations before re-entering. Mutual left recursion
  is ILR between rules that each re-enter the other.
- The **head** of a cycle is the re-entered invocation. The invocations in
  progress between the head and the re-entry are **involved** in the cycle.
- The head's **seed** is its current best outcome during growth. A **growth
  iteration** re-evaluates the head's pattern against the current seed.
- An outcome is **seed-dependent** when its evaluation observed a head's seed,
  either by re-entering the head or by reusing another seed-dependent outcome.

## Supported forms

- The runtime MUST support left-recursive cycles of any length, including
  direct, indirect, and mutual left recursion, through the single mechanism
  defined in this chapter. DLR is the cycle of length one.
- Cycles MUST be detected by invocation identity. Detection MUST NOT depend on
  which rule the immediate caller is, so invocations of the same rule with
  different resolved arguments are distinct, and re-entry through any number of
  intermediate rules (including parameterized rules and rule arguments) is
  detected.
- A cycle with no alternative that establishes a seed without re-entering the
  head (no base case) MUST fail and MUST terminate.

## Detection and growth

- Re-entering a head for the first time MUST produce a left-recursion outcome.
  Patterns and involved invocations MUST propagate that outcome unchanged to the
  head. An involved invocation MUST NOT treat another invocation's
  left-recursion outcome as its own and MUST NOT retain a memoized outcome for
  it.
- When the head receives its own left-recursion outcome it MUST grow by memoized
  seed-and-grow evaluation at its fixed input position: the seed starts as
  failure; each growth iteration re-evaluates the head's pattern, with every
  re-entry of the head yielding the current seed; an iteration that ends
  strictly further along the input replaces the seed and growth continues.
- Growth MUST require progress: the first iteration that fails, or succeeds
  without ending strictly further along the input than the seed, MUST terminate
  growth, and the head's outcome is the last seed.
- The head of a cycle is the first invocation of that cycle entered at the
  position. The outcome of a mutual cycle therefore depends on which of its
  rules is entered first; for a given grammar and input it MUST be
  deterministic.

## Seed-dependent outcomes

- A seed-dependent outcome MUST NOT be reused after a later growth iteration has
  replaced the seed it observed, anywhere along its chain of dependencies; it
  MUST be recomputed instead.
- A seed-dependent outcome SHOULD be reused within the growth iteration that
  produced it, so involved invocations are evaluated once per iteration rather
  than once per call site.
- After growth completes, a seed-dependent outcome produced during the head's
  final iteration MAY be reused: it was computed against the head's final
  outcome.
- An outcome that is not seed-dependent MUST remain reusable across growth
  iterations. In particular an independent cycle nested at the same position
  (for example a higher-precedence operator level) MUST NOT be re-grown on each
  iteration of an enclosing cycle.
- When a head is itself involved in an enclosing cycle, its growth is
  seed-dependent on the enclosing head and MUST be repeated whenever the
  enclosing head's seed changes (nested and interwoven cycles).

## Awaitable evaluation semantics

- Left-recursive evaluation MUST be defined over awaitable match results.
- Memo entries used for left-recursive evaluation MUST be able to represent
  in-progress awaitable growth as well as stabilized outcomes.
- Seed creation, growth, and stabilization MUST preserve the same fixed input
  position across awaitable evaluation steps.
- Implementations MAY complete growth synchronously when child evaluation is
  immediate, but that synchronous completion MUST be treated as an optimization
  of the awaitable model.
- Awaitable left-recursive growth MUST preserve determinism of branch order,
  memo reuse, progress checks, and seed-dependency tracking: the same grammar
  and input MUST produce the same outcome whether input arrives synchronously or
  asynchronously.

## Pattern-matching interactions

- Patterns that delegate to child patterns (for example, alternation and
  references) MUST propagate left-recursion outcomes unchanged unless their
  chapter defines stricter behavior.
- Alternation (`or`) SHOULD place left-recursive branches before non-recursive
  fallback branches when expressing left-associative constructs.
- The left-recursion handling contract used by `or` MUST follow this runtime
  chapter.
- Rule evaluation that awaits child results during left-recursive growth MUST
  still normalize final outcomes into the same success/failure/error/LR
  categories.
- When growth evaluates a pattern tree that includes
  [projection](../patterns/runtime/projection.spec.md) patterns, each successful
  growth step MUST carry the projected expression result as the match value used
  for later growth. Transforming left-associative AST folds MUST use nested
  projection (or whole-body projection desugared to the same mechanism), not
  solely a post-grow rule-level expression that never runs during growth.
- The head's rule-level expression applies only to its stabilized outcome.
  Involved invocations complete normally on every iteration, so their rule-level
  expressions apply to every iteration's outcome.
- When left-recursive growth succeeds, the caller-visible scope MUST match
  non-LR rule success: retain the caller's bindings and advanced input stream,
  and MUST NOT expose rule-local bindings created during growth.

## Memoization, eviction, and incremental interactions

- Recomputing a superseded seed-dependent outcome is part of evaluation, not
  [memo eviction](./memo-eviction.spec.md); eviction's low-water-mark contract
  is unchanged, because every involved invocation is at the head's position and
  the head is in progress for the whole of its growth.
- A seed-dependent outcome is only valid as part of the growth that produced it.
  [Incremental re-parsing](./incremental-parsing.spec.md) MUST NOT reuse it
  independently of its head, and the runtime MUST record on each rule outcome
  whether it was seed-dependent so that a delivered result can be rehydrated
  without its memo table.
- [Selective memoization](./selective-memoization.spec.md) remains compatible:
  every rule in a call cycle is memoized, so every head and involved invocation
  has an identity to detect and track.

## Why this design

- Supporting left recursion for any cycle, rather than only direct cycles, lets
  grammar authors split recursive and base arms across rules (for example to
  attach different projections) without rewriting the grammar.
- Tracking which outcomes observed a seed, rather than invalidating every
  outcome at the head's position on each iteration, keeps nested precedence
  levels at the same position linear: position-wide invalidation re-grows every
  nested level on every enclosing iteration, which is exponential in the number
  of levels unless stale results are reused as seeds on a monotonicity
  assumption that negative lookahead and projected values do not satisfy.
- Recording dependencies transitively (an outcome that reused a seed-dependent
  outcome is itself seed-dependent) closes the gap in involved-set approaches
  where a rule reached only through an already-memoized involved rule keeps a
  stale outcome across iterations.
- Detecting cycles by invocation identity rather than by caller frame removes
  both false negatives (cycles through other rules) and false positives (the
  same rule with different arguments).

## Research context

- This design follows the seed-and-grow research direction associated with
  Alessandro Warth's work on OMeta and left-recursive packrat parsing (Warth,
  Douglass, Millstein, "Packrat Parsers Can Support Left Recursion", 2008),
  cataloged at https://tinlizzie.org/ometa/. Ohm (co-created by Alessandro
  Warth) documents full left-recursion support at https://ohmjs.org/.
- Bounded left recursion (Medeiros, Mascarenhas, Ierusalimschy, "Left Recursion
  in Parsing Expression Grammars", 2014) gives the fixed-point semantics used
  here: iterate from a failing seed while the match grows.
- The Squirrel parser (Hutchison, 2026, https://arxiv.org/abs/2601.05012)
  derives per-invocation cycle detection and version-tagged invalidation; this
  chapter keeps its cycle detection and replaces per-position invalidation with
  per-outcome seed dependencies.

## Error conditions

- Left recursion MUST NOT itself be an error condition. There is no
  left-recursion error code; the former `E_INDIRECT_LEFT_RECURSION` code has
  been removed.

## Side effects

- Left-recursion handling MUST NOT produce externally observable side effects
  beyond match outcomes, memoization state, and defined diagnostics. Native
  expressions within involved invocations run once per growth iteration that
  evaluates them.

## Performance intent

- Implementations SHOULD preserve synchronous fast paths for immediate
  left-recursive growth when no awaitable child behavior occurs.
- Async-capable left-recursion support MUST NOT require gratuitous promise
  allocation on fully synchronous evaluation paths.
- Seed-dependency tracking SHOULD cost O(1) per memo lookup outside of
  left-recursive growth, and time proportional to the number of in-progress
  invocations above the head when a seed is observed.

## Composition intent

- Grammar authors SHOULD model left-associative operators using left-recursive
  structures when possible, directly or through helper rules.
- Grammar authors SHOULD enter a mutual cycle through the rule whose
  left-associative shape they intend, since the first entered rule is the head.

## Open questions

- Whether the head's rule-level expression should also apply to each growth
  seed, so a head and an involved rule project uniformly.
- Whether a statically computed head (as in pegen) should replace first-entry
  head selection, making mutual-cycle outcomes independent of entry order.
