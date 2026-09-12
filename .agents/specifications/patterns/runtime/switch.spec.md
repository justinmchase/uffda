# Switch pattern

This chapter defines the logical contract for author-declared committed-choice
dispatch matching.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `switch` pattern represents committed-choice dispatch over a fixed,
author-declared set of case keys. Unlike [`or`](./or.spec.md), which tries each
child pattern in order and backtracks past a failing branch, `switch` evaluates
each case's declared _key_ directly against the current input item (never
against the case's own body pattern), selects the first case whose key matches,
and commits to that case's body pattern result — success or failure — without
trying any other case.

This distinction matters for both semantics and performance: because keys are
declared by the grammar author rather than inferred from an arbitrary existing
pattern, dispatch is a direct check (equality against a literal-value set, or a
single Unicode character-class test) rather than an ordered trial of
sub-patterns, and it cannot fall prey to the soundness pitfalls of inferring a
FIRST-set from a pattern whose match behavior includes error paths.

## Behavioral expectations

- A `switch` pattern MUST inspect the current input position at most once per
  evaluation, before checking any case key.
- A `switch` pattern MUST evaluate case keys in declared order.
- A case key of kind `values` MUST resolve each of its declared value sources
  and MUST match when the current input item is strictly equal to any resolved
  value.
- A case key of kind `characterClass` MUST match when the current input item is
  a string and satisfies that Unicode character class.
- A `switch` pattern MUST select the _first_ case whose key matches and MUST
  evaluate only that case's body pattern.
- A `switch` pattern MUST return the chosen case's body pattern result directly
  (Ok, Fail, Error, or left-recursion outcome) as its own result — a failing
  chosen case MUST NOT cause the `switch` pattern to try any other case. This is
  the defining difference from `or`'s ordered-choice backtracking.
- If no case key matches and a `default` pattern is declared, the `switch`
  pattern MUST evaluate and return the `default` pattern's result.
- If no case key matches and no `default` pattern is declared, the `switch`
  pattern MUST fail. This MUST be a plain failure, never an error, regardless of
  the current input item's type or absence (end of input).
- A `switch` pattern with no cases and no `default` MUST fail for any input.

## Left-recursion behavior

- A `switch` pattern MUST propagate a left-recursion outcome from the chosen
  case's body pattern (or from `default`) unchanged.
- A `switch` pattern MUST NOT convert a left-recursion outcome into failure or
  success.
- Because dispatch commits to exactly one case, a `switch` pattern does not
  itself introduce new left-recursion combination points beyond what its chosen
  case's body already has.

## Input consumption

- A `switch` pattern MUST NOT consume input directly when checking case keys.
- When the chosen case's body pattern (or `default`) succeeds, the `switch`
  pattern MUST consume exactly the input consumed by that result.
- When the chosen case's body pattern (or `default`) fails, the `switch` pattern
  MUST fail without consuming input beyond what that failing evaluation itself
  consumed and then unwound.
- When no case matches and there is no `default`, the `switch` pattern MUST fail
  without consuming input.

## Expected output

- On success, the `switch` pattern MUST report the chosen case's (or
  `default`'s) matched value as its output value.
- On failure, the `switch` pattern MUST report failure output.

## Error conditions

- If resolving a case key's declared value source reports an error (for example,
  an unbound `$name` reference), the `switch` pattern MUST propagate that error
  immediately and MUST NOT continue checking subsequent cases.
- If a case key declares a character class that the runtime does not recognize,
  the `switch` pattern MUST report an error rather than silently treating the
  key as non-matching.
- If a case key declares a character class and the current input item is not a
  string, the `switch` pattern MUST report a type error rather than silently
  treating the key as non-matching — this matches the standalone
  [character](./character.spec.md) pattern's contract, so a non-tokenizable
  input item cannot be masked as a clean case/default fallthrough.
- If the chosen case's body pattern (or `default`) reports an error, the
  `switch` pattern MUST propagate that error unchanged.

## Side effects

- The `switch` pattern MUST NOT produce externally observable side effects
  beyond its match result and resulting matching context.

## Composition intent

- The `switch` pattern SHOULD be used where the grammar author already knows a
  small, discriminating dispatch key per alternative (for example, tokenizing on
  a leading character), and committed dispatch is acceptable (i.e., a matching
  key's body is expected to succeed; if it does not, that is a real failure, not
  a signal to try a different alternative).
- The `switch` pattern SHOULD NOT be used as a general substitute for `or` when
  true backtracking across ambiguous alternatives is required.
- The `switch` pattern MAY be composed with sequencing, capture, and repetition
  to describe grammars with fast, explicit dispatch points.

## Examples

### Dispatch a tokenizer on a leading character

```
// Pattern object
switch({
  cases: [
    { key: { kind: "values", values: [lit("#")] }, pattern: reference("Comment") },
    { key: { kind: "characterClass", characterClass: CharacterClass.Letter }, pattern: reference("Word") },
  ],
  default: reference("Punctuation"),
})
```

```
// Grammar rule
Token = switch {
  "#": Comment,
  \cL: Word,
  default: Punctuation
};
```

Input starting with `"#"` dispatches to `Comment`. Input starting with a letter
dispatches to `Word`. Any other input dispatches to `Punctuation`.

---

### Committed choice: a matching key's failing body does not fall through

```
// Grammar rule
Example = switch {
  "a": "z",  // key "a" matches, but the body only matches "z"
  default: ok
};
```

Input `"a"` selects the first case (key `"a"` matches), evaluates its body
(`equal("z")`) against the same input, and fails — the `switch` pattern does
**not** fall through to `default` even though `default` would otherwise succeed.
