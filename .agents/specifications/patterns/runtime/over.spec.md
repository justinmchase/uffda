# Over pattern

This chapter defines the logical contract for key-wise matching over
key-addressable values.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `over` pattern applies declared child patterns to keys of a single
key-addressable input value.

## Behavioral expectations

- An `over` pattern MUST inspect the current input position.
- If no input item is available at the current position, the `over` pattern MUST
  fail.
- The current input item MUST be either a JavaScript object value or a `Map`
  value for the `over` pattern to proceed.
- If the current input item is neither an object value nor a `Map`, the `over`
  pattern MUST report a type error.
- An `over` pattern MUST support declared string keys from its key map.
- An `over` pattern MUST evaluate key patterns in declaration order.
- For each declared key, the `over` pattern MUST evaluate the corresponding
  child pattern against a single-item input stream containing the current value
  for that key.
- When the current input item is an object value, declared keys MUST be resolved
  using JavaScript property-key semantics.
- When the current input item is a `Map`, declared string keys MUST be resolved
  using `Map` key semantics.
- For `Map` values, key presence MUST be determined by `map.has(key)` and MUST
  NOT be inferred from `map.get(key)` alone.
- A key MUST be treated as missing when it is not present in the current target
  value under the target's native key-presence semantics.
- Missing keys MUST be evaluated as `undefined` values.
- A present key with an explicit `undefined` value and a missing key both yield
  `undefined` as the child pattern input value.
- If any child pattern fails, the `over` pattern MUST fail.
- If every child pattern succeeds, the `over` pattern MUST succeed.

## Rest clauses

- An `over` pattern MAY include an ordered list of key/value rest clauses and an
  optional final catch-all clause.
- For object values, rest clauses MUST consider each own, enumerable,
  string-keyed property not declared in the pattern's key map. Symbol-keyed
  properties MUST be excluded.
- Object rest properties MUST be processed in JavaScript `Object.keys` order.
- For `Map` values, rest clauses MUST consider each entry not declared in the
  pattern's key map, in Map insertion order. The key pattern MUST receive the
  original Map key value, without coercion.
- A key-pattern failure MUST leave that entry unclaimed for later rest clauses.
- When a key pattern succeeds, the corresponding value pattern MUST be run. A
  key- or value-pattern failure MUST leave that entry unclaimed for later rest
  clauses.
- Named keys and entries claimed by earlier rest clauses MUST NOT be checked by
  later rest clauses. For a Map, declared keys are matched using native Map key
  identity.
- A final catch-all clause MUST accept all entries left unclaimed by earlier
  clauses. Without a catch-all, any remaining unclaimed entry MUST fail `over`.
- Left-recursion and error outcomes from key/value patterns MUST propagate
  unchanged.
- Variables captured by key/value patterns in rest clauses MUST be collected
  into arrays in the order of entries claimed by those clauses. A variable with
  no captured entries MUST be bound to an empty array.
- An optional entry capture name on a rest clause MUST collect each claimed
  `[key, value]` pair into an array in entry order.

## Left-recursion behavior

- If any child pattern reports a left-recursion outcome, the `over` pattern MUST
  propagate that outcome unchanged.
- The `over` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- An `over` pattern MUST consume exactly one outer input item when it succeeds.
- An `over` pattern MUST NOT consume outer input when it fails.
- An `over` pattern MUST NOT consume outer input when it reports a type error.
- Each child pattern evaluated for a key MUST consume only within that key's
  single-item nested input stream.
- Each nested key/value stream MUST have a unique position. Object paths extend
  the object's position by the property key and item index. Map paths extend the
  Map's position by the entry index, then distinguish the key from its value.
  Positions in two entries' streams MUST never coincide.

## Expected output

- On success, the `over` pattern MUST report the original input value as its
  output value, as an ordinary success, even when a field pattern's outcome is a
  skipped success (see [skip](./skip.spec.md)).
- On failure, the `over` pattern MUST report failure output.

## Error conditions

- If the current input item is neither an object value nor a `Map`, the `over`
  pattern MUST report a type error.

## Side effects

- The `over` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `over` pattern SHOULD be used to validate structured keyed data by
  matching selected declared keys.
- The `over` pattern MAY be composed with sequencing, alternation, conjunction,
  and traversal patterns to express keyed-structure grammar rules.

## Examples

### Match an AST node by kind and value type

```
// Pattern object
over({
  kind: equal("literal"),
  value: type(Type.Number)
})
```

```
// Grammar rule
NumberLiteral = { kind: "literal", value: Number }
```

Input `[{ kind: "literal", value: 42 }]` succeeds with value
`{ kind: "literal", value: 42 }`. Input `[{ kind: "literal", value: "x" }]`
fails at the `value` key check.

---

### Capture fields with variable bindings

Match an object and capture its fields for use in an expression.

```
// Pattern object
over({
  x: variable("x", type(Type.Number)),
  y: variable("y", type(Type.Number))
})
```

```
// Grammar rule with expression
Point = { x: x:Number, y: y:Number } -> Math.sqrt(x*x + y*y)
```

Input `[{ x: 3, y: 4 }]` succeeds, binding `x = 3` and `y = 4`; a rule
expression can then compute the magnitude `5`.
