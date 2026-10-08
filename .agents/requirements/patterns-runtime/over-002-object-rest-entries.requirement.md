---
id: over-002
title: Over matches undeclared object entries with rest patterns
spec_ref: ".agents/specifications/patterns/runtime/over.spec.md#object-rest-entries"
---

# Over Rest Entries

## Requirement

Preconditions:

- An `over` pattern with a rest-entry matcher is evaluated on an object or Map
  value.

Expected behavior:

- On an object, `over` MUST match every own, enumerable, string-keyed property
  not named in its declared key map; symbol-keyed properties MUST be ignored.
- On a Map, `over` MUST match every entry not named in its declared key map,
  using the original Map key value.
- For each remaining property or entry, `over` MUST match its key first and its
  value second.
- `over` MUST NOT apply the rest-entry matcher to declared keys.
- Object properties MUST be processed in `Object.keys` order. Map entries MUST
  be processed in insertion order.
- `over` MUST succeed when no undeclared properties or entries remain.
- A failing key or value child MUST fail `over`.

Postconditions:

- Success MUST preserve the original object or Map as the output value.
- Tests: `src/runtime/patterns/over.test.ts`.
