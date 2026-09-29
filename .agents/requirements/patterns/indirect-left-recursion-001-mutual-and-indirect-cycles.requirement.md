---
id: indirect-left-recursion-001
title: Indirect and mutual left-recursive cycles grow like direct left recursion
spec_ref: ".agents/specifications/runtime/left-recursion.spec.md#supported-forms; .agents/specifications/runtime/left-recursion.spec.md#detection-and-growth; .agents/specifications/runtime/left-recursion.spec.md#awaitable-evaluation-semantics"
---

# Indirect and Mutual Left Recursion

## Requirement

Preconditions:

- Rules are evaluated through the runtime rule-resolution path.
- A rule invocation is re-entered, at the same input position and with the same
  resolved arguments, through one or more other rule invocations while it is
  still in progress.

Expected behavior:

- Mutual recursion (`A = B "x" | "a"; B = A "y" | "b"`) MUST grow to the longest
  left-associative fixed point with the first entered rule as the head, for
  either entry rule.
- Growth MUST stop at the last seed when an iteration does not end strictly
  further along the input, leaving any unmatched input unconsumed.
- Indirect recursion through a pass-through rule (`E = T; T = E "+" N | N`) MUST
  produce the left-associative result `[[N, "+", N], "+", N]`.
- Interwoven cycles that share a rule
  (`E = F "e" | "x"; F = E "f" | G;
  G = F "g" | "y"`) MUST grow each head to
  its fixed point, re-growing an inner head whenever the enclosing head's seed
  changes.
- An independent left-recursive cycle nested at the same position inside an
  indirect cycle MUST keep its growth across the enclosing cycle's iterations.
- Cycles through parameterized rules and rule arguments MUST be detected and
  grow, keyed by resolved arguments.
- A cycle with no base case MUST fail and terminate.
- Projections within involved rules MUST apply on every growth iteration.
- Each case MUST produce the same outcome over immediately available and
  asynchronous input.

Postconditions:

- Grammar authors can express left-associative constructs through helper rules
  without rewriting them into direct left recursion.

## Test plan

- `src/requirements/patterns/indirect-left-recursion-001-mutual-and-indirect-cycles.requirement.test.ts`
  runs each case above over both `Input.Iterable(string)` and an async-generator
  input and asserts identical kind, value, and end position.
