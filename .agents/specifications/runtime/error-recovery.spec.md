# Runtime error recovery

This chapter defines the runtime contract for recovering from syntax errors
mid-parse: continuing past an erroneous region of input so that one parse
reports every error it can recover from and still produces a result for the
input around them.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Without recovery, a parse attempt is binary: the first unrecoverable mismatch
fails the whole parse, and consumers (the CLI, the language server, the MCP
server) see one failure. Tooling — editors above all, re-parsing on every
keystroke — needs a parse that tolerates a typo: it reports each erroneous
region and still yields structure for everything else.

Recovery points are grammar knowledge. Which input is safe to skip, and where
parsing may resume, depends entirely on the language (a statement ends at `;`, a
block at `}`, a token stream item at its boundary). So a grammar declares its
recovery points, as patterns; the runtime never guesses them, and host code
never hard-codes them.

## Scope

- This chapter governs recovery within a single match of a single pipeline
  layer's input, and how recovered outcomes compose with memoization, left
  recursion, incremental re-parsing, and pipelines.
- It does not change any outcome of a match evaluated with recovery disabled
  (see [Recovery setting](#recovery-setting)). Grammars that declare no recovery
  points, and hosts that never enable recovery, observe no difference.
- It defines what diagnostics recoveries yield (see
  [Diagnostics](#diagnostics)); each host's chapter defines how it reports them.

## Definitions

- A **recovery point** is a [recover](../patterns/runtime/recover.spec.md)
  pattern: a child pattern plus a **skip** pattern that consumes the erroneous
  input when the child fails.
- A **recovery** (activation) is one `recover` pattern succeeding by matching
  its skip pattern after its child failed.
- A **recovered match** is a success (`Ok` or skipped, see
  [skip](../patterns/runtime/skip.spec.md)) that is a recovery or that accepted
  (has as a successful child) a recovered match. A **clean** success is one that
  is not recovered.
- The **recovery setting** is whether the current evaluation permits recoveries.
  It is part of the evaluation context (the `Scope`), like the input position.
- A **phase** is one complete match of a pattern under a single top-level
  recovery setting: the **discovery** phase with recovery disabled, the
  **recovery** phase with it enabled.

## Grammar-declared recovery points

- Recovery MUST only ever occur at a `recover` pattern. No other pattern kind,
  runtime primitive, or host code path MUST skip input or convert a failure into
  a success on the grounds of error recovery.
- Host code (CLI, language server, MCP server, compiler drivers) MUST NOT
  hard-code synchronization tokens, rule names, or text patterns to recover from
  errors; it MAY only enable or disable the recovery setting and read the
  resulting match.
- Recovery MUST NOT be introduced through rule metadata:
  [rule metadata](./rule-metadata.spec.md#boundary-non-goal-for-this-chapter)
  may never alter matching behavior, and recovery alters it. A decorator MAY
  describe a recovery point for tooling (for example to name the construct it
  recovers), but the recovery itself is always a pattern.

## Recovery setting

- The recovery setting MUST default to disabled.
- With recovery disabled, a `recover` pattern MUST behave exactly as its child
  pattern does (outcome, consumption, value), and every other pattern MUST
  behave exactly as it does in a runtime without this chapter.
- The setting MUST propagate unchanged through every derived evaluation context
  — nested patterns, rule invocations, module boundaries, pipeline stages —
  except where this chapter disables it for a sub-evaluation
  ([Bounded, non-cascading recovery](#bounded-non-cascading-recovery),
  [Predicates](#predicates)).

## Two-phase matching

- A host requesting recovery MUST match in two phases: first the discovery
  phase, with recovery disabled; then, only when discovery fails, the recovery
  phase, from the same input position with recovery enabled. The result is the
  discovery phase's result when discovery did not fail, and the recovery phase's
  result otherwise.
- A discovery-phase `Error` or left-recursion outcome MUST be returned as is:
  errors are not syntax errors, and MUST NOT trigger the recovery phase.
- Two phases are required, not one: a recovery point can pre-empt input a later
  sibling would have matched cleanly (a repeated recoverable statement skipping
  over the construct that follows the repetition). Running recovery only after a
  clean parse failed guarantees that every input the grammar accepts parses
  exactly as without recovery.
- A recovery phase can only differ from the discovery phase at a `recover`
  pattern whose child failed. When the discovery phase fails without any
  `recover` pattern's child failing, the recovery phase MUST be skipped and the
  discovery phase's failure returned. Whether one did MUST be recorded while
  matching, not derived by inspecting the grammar. A discovery phase that reuses
  memoized outcomes without re-evaluating them (for example after
  [incremental re-parsing](./incremental-parsing.spec.md) rehydration) MUST
  assume one did whenever the parse those outcomes came from recorded one; an
  outcome from a parse that recorded none cannot contain one.

## Recovered matches

- A recovery MUST produce a success that spans from the `recover` pattern's
  position to the end of the skip pattern's match, whose value is the skip
  pattern's value, and whose `matches` are, in order, the child's failure and
  the skip pattern's success. When the skip pattern's success is skipped, the
  recovery is a skipped success, so a skipped recovery contributes nothing to a
  sequence (see [skip](../patterns/runtime/skip.spec.md)).
- Every recovered match MUST be marked recovered (`recovered: true`). The mark
  MUST be compositional: a success is recovered exactly when it is a recovery or
  one of its successful children is recovered. Rejected attempts (`Fail`
  children) MUST NOT make a success recovered. With recovery disabled no match
  is recovered, so composing the mark MUST cost nothing then.
- The `Match` union MUST NOT gain a kind for recovery. A recovery is a success
  of its grammar production — the parse continues after it — so it is an `Ok`
  (or a `Skip` when skipped), and every pattern composes it as one. The rule
  that a success beneath a success belongs to the accepted parse (see
  [editor metadata](../languages/cli/editor-metadata.spec.md#walking-the-parse))
  MUST continue to hold.
- Grammar authors choose the value a recovery yields (typically an error node of
  their AST) through the skip pattern, for example by projecting it. The runtime
  MUST NOT synthesize values for recoveries.

## Bounded, non-cascading recovery

- A recovery MUST consume at least one input item. A skip pattern that succeeds
  without consuming input MUST NOT produce a recovery; the `recover` pattern
  fails instead. This bounds the recoveries of one phase by the input length,
  keeping the recovery phase within the cost of an ordinary packrat parse.
- A skip pattern MUST be matched with recovery disabled, so a recovery never
  contains another recovery and every recovery's region is exactly the input its
  skip pattern matched.
- A recovery MUST NOT insert input or grammar structure: its span covers only
  items actually present in the input.

## Ordered choice

- In an [or](../patterns/runtime/or.spec.md) pattern, a recovered alternative
  MUST NOT pre-empt a later alternative that succeeds cleanly: `or` MUST choose
  the first clean alternative when there is one, and otherwise the first
  recovered alternative.
- A recovered alternative passed over for a clean one, and every recovered
  alternative after the first, MUST be retained as a rejected attempt: a `Fail`
  of that alternative's pattern, at the `or`'s position, whose sole child is the
  alternative's `Ok`.
- An error or left-recursion outcome from any alternative MUST still be
  propagated immediately, as without recovery.

## Predicates

- Predicates observe the grammar's language, not its recovery: the child of a
  [not](../patterns/runtime/not.spec.md) or
  [lookahead](../patterns/runtime/lookahead.spec.md) pattern, and the asserted
  pattern of an [except](../patterns/runtime/except.spec.md) pattern, MUST be
  matched with recovery disabled.
- The recovery setting of the context a predicate succeeds with MUST be the
  setting it was invoked with.

## Phase isolation

- A memoized rule outcome MUST only be reused under the recovery setting it was
  computed with: the recovery setting is part of the memo key, alongside the
  rule, its arguments, and the position.
- The origin a fresh rule invocation stamps on its result (see `MatchOrigin`)
  MUST record the recovery setting, and
  [incremental re-parsing](./incremental-parsing.spec.md) MUST rehydrate a
  reused entry under that setting only.
- A clean outcome is not phase-independent: a recovery point inside a rule can
  change the rule's outcome under the recovery setting even where it matched
  cleanly without it, so entries MUST NOT be shared across settings.

## Left recursion

- While a left-recursive head's seed is still a failure (see
  [growth](./left-recursion.spec.md)), reading it fails the reader as a control
  signal of growth, not because of the input. A `recover` pattern MUST NOT
  recover from a child failure that read a still-failing seed of a head whose
  growth was already in progress when the `recover` pattern began; it fails
  instead. The runtime MUST record such reads while matching, including reads
  through outcomes that depend on the seed.
- A head whose growth begins inside the `recover` pattern's child settles before
  the child returns, so its seed reads MUST NOT prevent the recovery.
- Every other failure inside growth is an ordinary syntax error: growth MUST
  accept a recovered candidate like any other, subject to the progress rule.
  Grammars whose left-recursive heads enclose most of the language (for example
  an expression's `Primary`) therefore still recover inside them.
- Consequently, a `recover` pattern wrapping a head's own left-recursive
  reference never recovers; recovery points around the head's invocation, or
  around the other constructs growth evaluates, handle its errors.

## Pipelines

- The recovery setting of a [pipeline](../patterns/runtime/pipeline.spec.md)
  MUST apply to every stage, and a pipeline whose stage recovered is recovered.
- A recovery's value flows to the next stage like any other value, so a layer
  (for example a tokenizer) MAY emit error items that the next layer's grammar
  matches explicitly.

## Open inputs

- Recovery over an [open input](../patterns/input-model.spec.md#open-inputs) is
  defined as for any input. A recovery whose skip pattern stopped at the end of
  the open input covers only the prefix typed so far; consumers SHOULD treat it
  as provisional, since more input may extend or resolve it.

## Collecting recoveries

- The runtime MUST expose the recoveries of a match's accepted parse — successes
  beneath successes, and everything beneath a `Fail` root — each once, in
  document order, each paired with the failure it replaced.
- Collection MUST be pure (no mutation of the match graph), deterministic, and
  MUST visit each node at most once; it MAY skip successful children that are
  not recovered. A match produced with recovery disabled contains no recoveries,
  so collection MAY return immediately for it.
- The same input, grammar, and recovery setting MUST produce the same
  recoveries.

## Grammar surface

- Pattern syntax spells a recovery point `ope P sneak by S`, and
  `ope P sneak by until T` for a skip that stops before `T`; see
  [pattern grammar](../languages/pattern-syntax/grammar.spec.md#recovery).
- Adopting recovery points in the repository's own grammars requires a published
  CLI that parses the syntax (see
  [compiler bootstrap](../languages/compiler-bootstrap.spec.md)).

## Host surface

- The runtime MUST expose two-phase matching to hosts as an explicit option of
  matching a module's entry rule, off by default.

## Diagnostics

- Each recovery in a match's accepted parse MUST yield one diagnostic, ranged
  over the source offsets of the input the recovery skipped (the recovery's
  source span), whose message is the
  [match diagnostics](./match-diagnostics.spec.md) analysis of the failure the
  recovery replaced.
- The diagnostics of a match MUST be, in document order, those of its
  recoveries, followed by the usual single failure diagnostic when the match
  failed. A clean success has none.
- A result with any diagnostic is not a clean result: hosts MUST report it as a
  failure even when a recovered value is available, and MAY report the recovered
  value alongside the diagnostics.
- A recovered value MUST NOT be consumed as though it were clean: in particular,
  a module source that parsed only by recovering MUST NOT be compiled, resolved,
  or written as an artifact. Editor features MAY read the recovered parse.
- The CLI, the
  [language server](../languages/cli/language-server.spec.md#diagnostics), and
  the
  [MCP server](../languages/cli/mcp-server.spec.md#error-and-determinism-contract)
  MUST match with recovery requested for every parse and every module or pattern
  execution; their chapters specify how diagnostics are reported (see also
  [compile and stream](../languages/cli/compile-and-stream.spec.md#parse-contracts)).

## Why this design

- **Declared, not automatic.** Automatic recovery (for example the squirrel
  parser's, which skips input at every sequence boundary) needs no grammar
  changes, but chooses resynchronization points the grammar author never saw and
  works in characters. Uffda layers match arbitrary values, and editor tooling
  must derive its behavior from the grammar; a declared recovery point keeps
  recovery visible, reviewable, and layer-agnostic.
- **A pattern, not a decorator.** Decorators are metadata-only by contract; a
  pattern composes anywhere (inside a rule body, a repetition, a pipeline stage)
  and needs no new declaration machinery.
- **An `Ok`, not a new match kind.** A new kind would force every pattern,
  walker, and consumer to handle it, although every composite already knows what
  to do with a success. A compositional flag is enough for the choices that must
  distinguish recovered from clean.
- **Two phases.** See [Two-phase matching](#two-phase-matching); the same
  argument is Theorem 3 of the squirrel parser paper (Hutchison, 2026,
  arXiv:2601.05012), whose constraints on bounded recovery, phase isolation, and
  left-recursion separation this chapter adopts.

## Related

- [recover pattern](../patterns/runtime/recover.spec.md)
- [runtime rules](./rules.spec.md) and [memo eviction](./memo-eviction.spec.md)
- [runtime left recursion](./left-recursion.spec.md)
- [incremental re-parsing](./incremental-parsing.spec.md)
- [match diagnostics](./match-diagnostics.spec.md)
- GitHub issue #168 — origin of this chapter.
