---
id: incremental-parsing-004
title: Reuse proves unchanged observations and remaps retained graphs to fresh input domains
spec_ref: ".agents/specifications/runtime/incremental-parsing.spec.md#core-contract; .agents/specifications/runtime/incremental-parsing.spec.md#position-remapping; .agents/specifications/runtime/incremental-parsing.spec.md#multi-stage-pipelines"
---

# Observation Proof and Fresh Domains

## Requirement

Preconditions:

- A completed parse receives an outermost-stream edit with `at`, `removed`, and
  `inserted` item counts and the complete post-edit JSON-compatible input.

Expected behavior:

- Edit ranges and post-edit lengths MUST be validated without integer overflow.
  Invalid edits MUST leave the prior result and its memo state usable.
- Input prefix comparison MUST distinguish changed values, object property
  order, and signed zero. Identical JSON arrays and objects MAY preserve prior
  prefix item identity to permit reuse under nested `into` and `over` matches.
- A retained match MUST NOT be reused merely because its consumed span ends
  before the edit. Every retained descendant observation, including failed
  branches and lookahead past the consumed span, MUST also be proven unchanged.
  An observation at the edit boundary MUST conservatively invalidate the
  enclosing candidate.
- Nested observations beneath a proven-identical outer prefix item MAY permit
  reuse of the enclosing outer rule. Structural paths MUST remain distinct.
- Computed pipeline domains whose affected region cannot be proven MUST be
  re-evaluated; an outer edit's cursor MUST NOT be applied to those domains.
- Matches dependent on a left-recursive seed MUST NOT be reused independently.
  Conservative invalidation of their enclosing rule is permitted.
- A prior parse that reached recovery MAY be fully re-evaluated. Recovery phase
  state MUST NOT leak from the prior parse into the new discovery phase.
- Captured graphs MUST use the fresh outer input domain and preserve nested
  paths, values, origin metadata, and diagnostics. Repeated edits MUST not
  consult stale input domains, and prior graphs MUST remain unchanged.

Postconditions:

- Edited parses MUST match fresh parses in outcome, value, consumed position,
  recovery activations, and diagnostics, including after forced collection.
- Tests: `rust/src/runtime/tests.rs`, `rust/src/pattern/tests.rs`, and
  `rust/src/runtime/input.rs`.
