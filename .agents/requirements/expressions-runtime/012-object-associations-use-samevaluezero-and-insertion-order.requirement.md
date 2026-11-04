---
id: expressions-runtime-012
title: Runtime Object associations use SameValueZero keys and insertion order
spec_ref: ".agents/specifications/expressions/object.spec.md#behavioral-expectations; .agents/specifications/expressions/object-computed-key.spec.md#behavioral-expectations; .agents/specifications/standard-library.spec.md#object-associations"
---

# Object Associations

## Requirement

Preconditions:

- Runtime code constructs, looks up, updates, enumerates or serializes an Object.

Expected behavior:

- Object is the sole runtime association type and accepts any runtime value as
  a key.
- Key lookup, duplicate detection and update MUST use SameValueZero semantics.
- Updating an existing key MUST preserve its insertion position; adding a
  previously absent key MUST append an entry.
- Object iteration and entry extraction MUST preserve insertion order.
- Spreading or iterating an Object without an explicit iterator MUST yield
  `[key, value]` entry pairs in insertion order.
- `at(object, index)` MUST return the indexed `[key, value]` pair,
  `has(object, key)` MUST test key presence independently of value, and
  `length(object)` MUST return the entry count.
- JSON conversion MUST reject non-string Object keys rather than coercing them.

Postconditions:

- Runtime observations retain native key identity, key distinction and
  insertion order.
- Tests: `src/evaluate/tests.rs`, `src/globals/tests.rs`,
  `src/pattern/composite_ports.rs`.
