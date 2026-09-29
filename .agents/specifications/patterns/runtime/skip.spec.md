# Skip pattern

This chapter defines the logical contract for matching input that contributes no
value.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `skip` pattern consumes whatever its child pattern matches and contributes
nothing to the values collected by an enclosing sequence or repetition. It lets
a grammar select items with patterns (for example, keep tokens and drop
whitespace) instead of collecting everything and filtering in an expression.

## Behavioral expectations

- A `skip` pattern MUST evaluate its child pattern at the current input
  position.
- If the child pattern succeeds, the `skip` pattern MUST report a **skipped
  success** (see
  [Outcome categories](../pattern-matching.spec.md#outcome-categories)).
- If the child pattern fails, the `skip` pattern MUST fail.
- If the child pattern reports an error, the `skip` pattern MUST propagate that
  error.
- A `skip` pattern MUST report a skipped success whether its child succeeded
  normally or was itself skipped.

## Skipped success propagation

A skipped success is interpreted by the pattern that contains it, according to
one rule:

- A pattern whose output value is, by its own contract, exactly one child
  pattern's matched value MUST report a skipped success when that child's
  outcome is a skipped success. This applies to `or` (the chosen branch),
  `resolve` and rule invocation without a rule expression, `variable`, `maybe`
  (when its child matched), `and` (the final child), `switch` (the chosen case),
  `into`, `pipeline` (the final step), and `recover` (its child on success, its
  skip pattern on a recovery).
- A pattern that builds its own output value MUST report an ordinary success
  regardless of whether a child was skipped. This applies to `then` and
  `quantifier` (which omit skipped children from their arrays), `projection` and
  rule expressions (whose value is the expression result), `not`, `except`,
  `lookahead`, and `over`.
- Patterns without child patterns never report a skipped success.

Each pattern's chapter states how it treats a skipped child.

## Left-recursion behavior

- A `skip` pattern MUST propagate a child pattern's left-recursion outcome
  unchanged.
- A `skip` pattern MUST NOT convert a left-recursion outcome into failure or
  success.

## Input consumption

- A `skip` pattern MUST consume exactly the input its child pattern consumed.
- When the child pattern fails, the `skip` pattern MUST fail without consuming
  input.

## Expected output

- A skipped success MUST report `undefined` as its output value.
- A `skip` pattern MUST keep the bindings its child pattern produced: in
  `skip sep:string`, `sep` is bound in the resulting scope even though the
  matched value is not collected.

## Host boundary

- A skipped success at the top of a match is a success. Value-returning entry
  points MUST report `undefined` as its value.

## Error conditions

- The `skip` pattern itself does not introduce new error states.

## Side effects

- The `skip` pattern MUST NOT produce externally observable side effects beyond
  its match result and resulting matching context.

## Composition intent

- The `skip` pattern SHOULD be used to drop delimiters, trivia, and unwanted
  items from collected values.
- Skipping MAY be named once in a rule without an expression (for example
  `rule Ws = skip " "*;`); every reference to that rule is then skipped.
- `skip P?` skips whether or not `P` matched, whereas `(skip P)?` skips only
  when `P` matched and otherwise contributes `undefined`.
- `skip v:P` binds the value of `P` to `v` and skips it; `v:skip P` binds
  `undefined`, because the skip's value is `undefined`.

## Examples

### Keep strings, drop everything else

```
// Pattern object
quantifier(or([type(Type.String), skip(any)]))
```

```
// Grammar rule
Strings = (string | skip)*
```

Input `["a", 1, "b", 2]` succeeds with value `["a", "b"]`.

---

### Drop whitespace named once

```
// Grammar rules
Ws = skip " "*
Words = (Word | Ws)*
```

Every `Ws` match is omitted, so the words are collected without the spaces
between them.

---

### Keep a skipped value in a binding

```
// Grammar rule
Joined = [skip sep:string rest:string*] -> (join rest sep)
```

Input `[".", "a", "b", "c"]` succeeds with value `"a.b.c"`. The separator is
omitted from the collected values but remains bound as `sep`.

---

### Skip on its own

```
// Grammar rule
Comma = skip ","
```

Input `","` succeeds with value `undefined` and consumes the comma.
