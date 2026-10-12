# Standard library specification

This chapter defines the default global functions available to Uffda
expressions. It describes their shared purpose and the invariants they compose
with; exact acceptance cases belong in requirements and tests.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in RFC 2119 and RFC 8174 when, and only when, they appear in all
capitals.

## Default global surface

The default runtime environment provides the following 36 callable globals.
Their names are case-sensitive and are the public expression references:

| Global                                  | Purpose                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `add(left, right)`                      | Adds two numbers.                                                                                                                                      |
| `at(value, index)`                      | Selects the element at an ordinal index from a string, array, Set, or Map. String indexing follows UTF-16 code units; Set and Map use iteration order. |
| `base58(bytes)`                         | Encodes bytes with the Bitcoin Base58 alphabet.                                                                                                        |
| `coalesce(...values)`                   | Returns the first argument that is neither null nor undefined.                                                                                         |
| `compare(left, right)`                  | Compares two numbers or two strings and returns -1, 0, or 1.                                                                                           |
| `eq(left, right)`                       | Tests strict runtime equality.                                                                                                                         |
| `enumerate(value)`                      | Lazily pairs each item with its index as `{ index, value }`. Strings are iterated by Unicode code point.                                               |
| `filter(value, predicate)`              | Lazily yields items for which the predicate is truthy.                                                                                                 |
| `flat(array, depth?)`                   | Flattens a nested array by the requested depth, defaulting to one level.                                                                               |
| `format(template, ...args)`             | Replaces `{0}`, `{1}`, … with corresponding non-nullish arguments.                                                                                     |
| `from_entries(entries)`                 | Builds an object from `[key, value]` pairs or `{ name, pattern }` / `{ name, value }` entries.                                                         |
| `gt(left, right)`                       | Tests whether the supported ordering of left is strictly after right.                                                                                  |
| `gte(left, right)`                      | Tests whether the supported ordering of left is after or equal to right.                                                                               |
| `has(collection, value)`                | Tests membership in a Set, Map, or array, or key presence in an object.                                                                                |
| `id(value)`                             | Returns its argument unchanged.                                                                                                                        |
| `int(value)`                            | Parses a scalar value as a base-10 integer.                                                                                                            |
| `iterable(value)`                       | Normalizes a synchronous or asynchronous iterable for runtime iteration.                                                                               |
| `join(array, separator?)`               | Joins array elements with a separator; nullish elements become empty strings and other elements use the runtime's scalar text conversion.              |
| `json(value)`                           | Serializes a value as JSON text, subject to runtime JSON and callable-conversion rules.                                                                |
| `last(value, fallback)`                 | Returns the last element of a string or array, or the fallback when empty or unsupported.                                                              |
| `length(value)`                         | Returns the length of a string, array, Set, or Map. String length is measured in UTF-16 code units.                                                    |
| `lt(left, right)`                       | Tests whether the supported ordering of left is strictly before right.                                                                                 |
| `lte(left, right)`                      | Tests whether the supported ordering of left is before or equal to right.                                                                              |
| `map(value, callback)`                  | Lazily projects each item through a callback.                                                                                                          |
| `not(value)`                            | Returns the logical negation of the value's truthiness.                                                                                                |
| `one(items, fallback)`                  | Returns the sole item of a one-element array, or the fallback otherwise.                                                                               |
| `pack(...values)`                       | Collects its arguments into an array.                                                                                                                  |
| `pluck(collection, key)`                | Collects `item[key]` for each item in a collection.                                                                                                    |
| `reduce(value, initial, fn)`            | Eagerly folds the items into one value by applying `fn(accumulator, item)`.                                                                            |
| `scan(value, initial, fn)`              | Lazily yields each accumulator produced by `fn(accumulator, item)`.                                                                                    |
| `sha256(text)`                          | Computes the SHA-256 digest of a string and returns bytes.                                                                                             |
| `slice(value, start?, end?)`            | Returns the selected half-open slice of a string or array.                                                                                             |
| `sub(left, right)`                      | Subtracts right from left.                                                                                                                             |
| `symbol(name)`                          | Returns the well-known or registered symbol for a name.                                                                                                |
| `to_set(value)`                         | Converts a collection into a Set.                                                                                                                      |
| `when(condition, thenValue, elseValue)` | Returns `thenValue` when condition is truthy, otherwise `elseValue`.                                                                                   |

The TypeScript implementation also attaches descriptive function metadata. The
Rust implementation exposes the corresponding callable name and declared arity.
Both implementations MUST provide the same name set and declared arities. Names
or behaviors outside this inventory MUST NOT be added merely to support one
language module or application; a genuinely general-purpose addition requires
updating this contract and its requirements.

Global references remain ordinary scope values: user scope may shadow a default
global, and a global is callable only when the resolved value is callable. See
[expression reference and member evaluation](./expressions.spec.md) for
resolution and invocation contracts.

## Composition and data boundaries

Globals MUST use ordinary runtime values and evaluation semantics. A callback or
iterator supplied by a caller is not granted special host-language privileges.
Lazy collection operations MAY defer iteration and callback execution until a
consumer requests items; an operation that returns an iterator MUST preserve the
runtime's iterator and error behavior.

The library is intended for general-purpose parser/runtime composition and
should remain small. Globals SHOULD be deterministic helpers over their
arguments unless their documented purpose requires an iterator, callback, or
cryptographic operation. They MUST NOT introduce hidden access to a current
rule, match, module, or source location. Source provenance is carried by runtime
values as specified in [value provenance](./runtime/value-provenance.spec.md).

`json` is explicit data serialization, not implicit text conversion. Its
callable rejection and conversion boundaries are governed by
[runtime callable conversion](./runtime.spec.md#callable-conversion). JSON hook
execution is governed by the runtime's JSON-hook contract; this chapter does not
redefine that mechanism.

## Shared implementation evidence

`test/rust/globals-surface-fixtures.json` is the shared name-and-arity fixture
for the TypeScript and Rust implementations. The shared behavior corpus is
`test/rust/globals-fixtures.json`; it includes at least two cases per global,
including expected failures where applicable. Where that corpus includes an
implementation-specific expected value, it records an observed cross-runtime
difference rather than silently treating that difference as general library
behavior.

## Approved platform divergence

The behavior fixture currently has `rustExpected` values for `json` inputs with
callable `toJSON` properties. This is an intentional platform divergence, not an
unresolved parity defect: TypeScript preserves Promise-shaped output from lambda
hooks and MUST NOT await those hooks merely to resemble synchronous JavaScript
JSON serialization. Rust has no Promise language value and invokes authored
hooks through its evaluator, consuming completed results as required by
[`runtime.spec.md`](./runtime.spec.md#synchronous-completion-and-the-rule-boundary).
Keep the `rustExpected` fixture values to make the difference explicit. Do not
change either platform's behavior solely to eliminate this divergence.

The per-global boundary and edge-case acceptance matrix is defined in
[default-global-edge-cases](../requirements/standard-library/002-default-global-edge-cases.requirement.md).
Shared JSON fixtures cover portable value behavior. Requirements for identity,
undefined, native runtime values, errors, and provenance use direct runtime
assertions in each implementation; they MUST NOT reduce those observations to
serialized JSON equality.
