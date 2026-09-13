# Runtime compiled pattern dispatch

This chapter defines the runtime contract for compiling a pattern node into a
reusable matching closure once, instead of re-dispatching on the node's kind
through a generic interpreter on every match attempt.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

The generic pattern interpreter (see [runtime rules](./rules.spec.md))
dispatches on a pattern node's kind via a single `switch` every time that node
is matched, regardless of how many times the same node is visited during a
parse. Profiling a real grammar's compile (`examples/morse/morse.uff`) showed
that high call-volume, structurally simple pattern kinds (for example a sequence
of steps, a first-match alternation, or a single-character class check) are each
invoked hundreds of thousands to millions of times, and that this dispatch is
repeated identically on every single one of those calls even though the node's
own kind, and everything about it that does not depend on the current `Scope`,
never changes between invocations.

Compiled pattern dispatch lets a pattern node be compiled into a closure once,
the first time it is matched, and reused directly on every subsequent match of
that same node — skipping the generic dispatch and any per-call recomputation of
the node's static shape (for example, a character class's regular expression)
for kinds that have a compiled implementation.

## Scope

- This chapter governs how a pattern node's matching behavior is dispatched: by
  a per-node cached closure ("compiled") when the node's kind has a compiled
  implementation, or by the generic interpreter (kind-by-kind `switch` dispatch)
  otherwise.
- This chapter does not change matching semantics: a pattern node's match
  outcome (success/failure/error, matched value, consumed input, and
  diagnostics) MUST be identical whether it is matched via a compiled closure or
  via the generic interpreter.
- Not every pattern kind is required to have a compiled implementation. A kind
  without one is always matched via the generic interpreter. Implementations MAY
  extend compiled coverage to additional kinds over time without this being an
  observable behavior change.
- A pattern tree MAY freely mix compiled and interpreted nodes: a compiled
  composite node (for example, one that matches a sequence of child patterns)
  MUST dispatch each child through the same compile-or-interpret decision,
  recursively, so coverage gaps in child kinds never affect correctness.
- This chapter's compilation is purely a per-node dispatch and closure-reuse
  optimization. It does not change, and is independent of, rule-level packrat
  memoization (see [runtime rules](./rules.spec.md) and
  [runtime selective memoization](./selective-memoization.spec.md)), left
  recursion growth (see [runtime left recursion](./left-recursion.spec.md)), or
  incremental re-parsing's origin-tagging and rehydration (see
  [runtime incremental re-parsing](./incremental-parsing.spec.md)): all of those
  operate at the rule-invocation boundary, above individual pattern node
  dispatch, and are unaffected by whether a given node happens to be compiled.

## Compilation

- A pattern node MUST be compiled at most once per runtime instance: an
  implementation MUST cache the compiled closure keyed by the node's own
  identity (not by its kind or structural equality with other nodes), so that
  two distinct node objects with identical shape are compiled independently, and
  a single node object already compiled is never recompiled by the same runtime
  instance.
- The compiled-closure cache MUST be owned by a per-runtime-instance object (for
  example, the same object that already owns other per-instance state such as
  resolved module declarations), never by process-wide or module-level global
  state. Two independently constructed runtime instances (for example, a
  sandboxed instance, a test instance, or two instances configured with
  different overridable behavior) MUST NOT observe or share each other's
  compiled closures for the same pattern node, even when both happen to match
  that exact same node object. Each such instance MAY redundantly compile the
  same node the first time that instance matches it; this is a correctness
  boundary, not a caching optimality target.
- Compiling a node MUST NOT observe or depend on any particular `Scope`: only
  information available from the node's own declaration (its kind and its static
  fields, such as a nested pattern, a list of child patterns, or a fixed
  character class) MAY be used to build the closure. Anything that depends on
  the current match attempt (the stream position, variable bindings, and so on)
  MUST be read fresh by the closure itself on each invocation, not baked in at
  compile time.
- For a composite pattern kind with a compiled implementation, compiling it MUST
  also request compilation of each of its child pattern nodes (whether or not
  those children themselves have a compiled implementation), so a single
  top-level compile call transitively prepares reusable closures for an entire
  subtree.

## Interactions

- This chapter's compiled-vs-interpreted decision for a given pattern node MUST
  NOT vary based on how many times, or in what order, the node is matched: it is
  a property of the node's kind (whether that kind has a compiled
  implementation), decided once and cached for that node.
- Because pattern nodes are also the values `MatchOrigin` and rule diagnostics
  reference (see [runtime rules](./rules.spec.md)), a compiled node's match
  result MUST reference the same pattern node object an interpreted match of
  that node would have, so diagnostics and origin-tagging are unaffected by
  whether the node was compiled.
