---
id: over-002
title: Over matches undeclared object entries with rest patterns
spec_ref: ".agents/specifications/patterns/runtime/over.spec.md#object-rest-entries"
---

# Over Object Rest Entries

## Requirement

Preconditions:

- An `over` pattern with a rest-entry matcher is evaluated on an object value.

Expected behavior:

- `over` MUST match every own, enumerable, string-keyed property not named in
  its declared key map.
- For each such property, `over` MUST match its key first and its value second.
- `over` MUST NOT apply the rest-entry matcher to declared keys.
- `over` MUST succeed when no undeclared enumerable properties remain.
- A failing key or value child MUST fail `over`.

Postconditions:

- Success MUST preserve the original object as the output value.
- Tests: `src/runtime/patterns/over.test.ts`.
