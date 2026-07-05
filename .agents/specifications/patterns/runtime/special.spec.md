# Special pattern

This chapter defines the logical contract for runtime-provided special pattern
dispatch.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Patterns specification](../../patterns.spec.md#conventions).

## Logical purpose

The `special` pattern dispatches to runtime-provided special values that can
delegate matching to a module default rule or a specific rule value.

## Behavioral expectations

- A `special` pattern MUST require a non-null special value.
- If the special value is null or missing, the `special` pattern MUST report a
  null-value error.
- Function-valued specials MUST NOT be accepted by the current runtime pattern
  implementation.
- If the special value is a function, the `special` pattern MUST report a type
  error.
- If the special value denotes a module special, the `special` pattern MUST run
  that module in the current matching context by dispatching through runtime
  module execution semantics.
- If the special value denotes a rule special, the `special` pattern MUST
  evaluate that rule in the current matching context.
- If delegated module or rule evaluation succeeds, the `special` pattern MUST
  succeed.
- If delegated module or rule evaluation fails, the `special` pattern MUST fail.
- If delegated module or rule evaluation reports an error, the `special` pattern
  MUST propagate that error.

## Left-recursion behavior

- If delegated module or rule evaluation reports a left-recursion outcome, the
  `special` pattern MUST propagate that outcome unchanged.
- The `special` pattern MUST NOT convert a left-recursion outcome into failure
  or success.

## Input consumption

- A `special` pattern MUST NOT consume input directly.
- A `special` pattern MUST consume exactly the input consumed by its delegated
  module or rule evaluation.
- If special-value validation fails before delegation, the `special` pattern
  MUST report an error without consuming input.

## Scope behavior

- Delegated evaluation MAY push module or rule scopes internally.
- On successful delegation, the `special` pattern MUST restore caller-visible
  scope boundaries while preserving delegated matching progress and results.

## Expected output

- On success, the `special` pattern MUST report the delegated module or rule
  matched value as its output value.
- On failure, the `special` pattern MUST report failure output.

## Error conditions

- Null or missing special value MUST report a null-value error.
- Function-valued special MUST report a type error.
- Module-special dispatch without a valid executable default rule MUST report
  the corresponding runtime error from delegated execution.

## Side effects

- The `special` pattern MUST NOT produce externally observable side effects
  beyond its match result, resulting scope state, and resulting matching
  context.

## Composition intent

- The `special` pattern SHOULD be used for controlled runtime integration points
  where parser behavior is supplied as module or rule values.
- The `special` pattern MAY be composed with sequencing, alternation,
  conjunction, and traversal patterns to embed reusable runtime-provided parsing
  behavior.

## Examples

### Dispatch to a runtime-supplied module

Evaluate the default rule of a module that was resolved at runtime and supplied
as a special value.

```
// Pattern object
special("tokenizer", {
  kind: SpecialKind.Module,
  module: tokenizerModule
})
```

The active module is temporarily switched to `tokenizerModule` and its default
export is evaluated. On success, the scope is restored to caller-visible
boundaries.

---

### Dispatch to a runtime-supplied rule via pattern interpolation

Evaluate a specific rule that was resolved at runtime and passed in as a special
value. This enables conditional or dynamic grammar composition.

```
// Pattern object
special("customParser", {
  kind: SpecialKind.Rule,
  rule: customRule
})
```

```
// Grammar rule with pattern interpolation
Program = Header customParser Footer
```

The supplied `customRule` is evaluated directly in the current matching context,
scoped according to the rule's own module. This allows the grammar author to
compose rules dynamically, similar to metaprogramming with string interpolation
but for entire pattern rules.
