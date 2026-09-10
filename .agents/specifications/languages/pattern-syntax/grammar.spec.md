# Pattern grammar

This chapter defines the grammar contract for the right-hand side of a pattern
declaration.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Pattern syntax contracts](../pattern-syntax.spec.md#conventions).

## Logical purpose

Pattern grammar provides the declarative matching language used to build runtime
patterns from smaller, reusable forms. It is the syntax layer that describes
what a pattern body may contain; it does not define declaration headers, import
resolution, or expression evaluation.

## Grammar boundary

- The grammar MUST cover only pattern-body syntax.
- The grammar MUST NOT include declaration wrappers such as `PatternDeclaration`
  headers, import statements, export statements, or module scaffolding.
- The grammar MUST NOT redefine expression syntax.
- The grammar MAY include expression **slots** at projection forms (`P -> E`),
  where `E` is parsed by ExpressionLang and the form normalizes to the
  [projection](../../patterns/runtime/projection.spec.md) runtime pattern.
- Expressions outside projection slots remain the responsibility of higher
  layers that combine pattern bodies with expression-bearing declaration forms.

## Canonical form

- The grammar SHOULD normalize to a canonical nested pattern tree.
- The grammar MUST preserve evaluation order for ordered composition forms.
- The grammar MUST preserve branch order for choice forms.
- The grammar MUST preserve explicit grouping where nested pattern structure is
  semantically relevant.

## Pattern families

The grammar MUST be able to express the following pattern families:

- primitive matchers, including `any`, `end`, `ok`, `fail`, bare literal
  equality, reserved type keywords, Unicode property classes, membership
  (`in[...]`), and `variable`; `between`, and `quantifier`;
- traversal and delegation forms, including `into`, `over`, `pipeline`, and
  `resolve`;
- boundary and lookaround forms, including `lookahead`;
- runtime-adjacent forms whose syntax normalizes to the corresponding pattern
  runtime contract.

## Syntax governance

- The grammar SHOULD prefer explicit, deterministic forms and low-sugar operator
  spellings for composition.
- The grammar MUST avoid ambiguous precedence between distinct pattern families.
- The grammar MUST define how a form's children are delimited and how child
  order is preserved.
- If a syntactic form has fixed arity, the grammar MUST make that arity
  explicit.
- If a syntactic form accepts a variadic child list, the grammar MUST preserve
  that list in source order.
- The grammar MUST treat `|` as the alternation operator and `&` as the
  conjunction operator.
- The grammar MUST NOT accept keyword aliases for alternation or conjunction
  operators.
- The grammar MAY allow a leading `|` before the first alternation branch.

## Binding and repetition

- Variable capture MUST use `name:P`, where `name` is an identifier and `P` is
  the captured child pattern.
- Capture MUST bind less tightly than postfix repetition and more tightly than
  ordered sequence composition.
- A keyed object entry such as `{ field: x:P }` MUST parse its first colon as
  the field separator and its second colon as the nested variable capture.
- Repetition MUST use postfix syntax on a primary or explicitly grouped child:
  - `P*` means zero or more matches.
  - `P*min` means at least `min` matches.
  - `P*min..max` means between `min` and `max` matches, inclusively.
  - `P*..max` means between zero and `max` matches, inclusively.
  - `P+` is the canonical shorthand for `P*1`.
  - `P?` maps to the scalar `maybe` pattern and MUST remain distinct from
    `P*..1`, whose result is an array.
- Bounds numerals MUST be non-negative integers (authored via digit
  `BoundLiteral` forms) or contextual `$name` (`BoundVariable`). See Value
  sources.
- Value operands on equal, between, includes, and quantifier bounds MAY be
  contextual `$name` references. See Value sources.
- An open range with neither bound (`P*..`) MUST be rejected at parse time.
- A maximum less than its minimum MAY parse to a Quantifier AST; the
  [quantifier](../../patterns/runtime/quantifier.spec.md) runtime MUST reject
  that pattern when it is evaluated.
- Repetition suffixes MUST NOT be chained.
- Bounds immediately following `*` MUST belong to that repetition regardless of
  intervening whitespace. Authors MUST group an unbounded repetition before
  sequencing it with a numeric literal, as in `(P*) 1`.

## Value sources

- A **value source** is a tagged operand with an explicit `kind`:
  - `value.literal` — compile-time constant (`{ kind: "value.literal", value }`)
  - `value.variable` — contextual `$name` (`{ kind: "value.variable", name }`)
- Value operands in the pattern AST MUST NOT be bare serializable values. Syntax
  (or an explicit host constructor such as `lit(...)`) MUST choose the kind;
  matchers MUST NOT infer literal vs variable by duck-typing operand shape.
- `$name` parses as `"$"` + Identifier and projects `value.variable`.
- Bare literals and identifier string equals project `value.literal`.
- Value sources MUST be accepted only in value-operand positions:
  - bare equal
  - `between` bounds: closed `L..R`, open-upper `L..`, open-lower `..R` (bare
    `..` MUST be rejected)
  - `includes` membership elements (`in[...]`)
  - quantifier `min` / `max` bounds (`P*$n`, `P*$min..$max`, mixed literal /
    `$name` forms in `prefix.uff`)
- `$name` always denotes a value binding. Bare `$name` as a primary MUST
  normalize to `equal` with a `value.variable` operand (match input equal to the
  bound value), not to `resolve`.
- Bare identifiers retain existing meanings: pattern position → resolve; literal
  value position → identifier string as `value.literal`.
- Open between forms MUST project omitted bounds as `undefined`:
  - `L..` → `{ kind: "between", left, right: undefined }`
  - `..R` → `{ kind: "between", left: undefined, right }`
  - Arms MUST prefer closed `L..R`, then `L..`, then `..R`, so `1..3` stays
    closed. Bare `..` MUST NOT match any between arm.

## Precedence

From tightest to loosest, pattern syntax MUST apply primary/grouping, postfix
repetition, prefix operators and capture, ordered sequence, pipeline, projection
(`->`), conjunction, and alternation.

## Projection forms

- Projection MUST use the spelling `P -> E`, where `P` is a pattern and `E` is
  an ExpressionLang expression slot.
- `P -> E` MUST normalize to a projection pattern with child `P` and expression
  `E`.
- Ordered sequence MUST bind more tightly than projection, so `A B -> E` MUST
  mean projecting the sequence `(A B)`.
- Projection MUST bind more tightly than `|` and `&`, so in PatternLang
  `P -> E | Q` MUST normalize to alternation of a projected `P` with `Q`.
  Authors MAY still write `(P -> E) | Q` for clarity.
- In Uffda rule declarations, depth-0 `->` remains the whole-body projection
  delimiter. Nested projections inside a rule pattern body MUST appear inside
  grouping (`(…)`, `[…]`, or `{…}`) so they are not cut as the rule-level
  projection.
- Projection MUST remain distinct from pipeline (`|>`).

## Worked examples

The following style is valid when leading `|` alternation is enabled:

```uff
Example =
  | Foo
  | Bar
  | Baz
  ;
```

The following multiline forms SHOULD be treated as canonical authoring style for
larger grammars because they keep precedence visible without extra sugar:

```uff
Message =
  | "literal"
  | any
    |>
    [end]
    |>
    ok
  | {
      name: string,
      aliases: [any+],
    }
  ;
```

- Authors SHOULD place each top-level alternative on its own line when a rule
  grows beyond a short single-line form.
- Pipeline steps SHOULD be vertically aligned with one `|>` step per line in
  multiline forms.
- Object-like keyed forms SHOULD use one key per line with a trailing comma when
  that improves diffability.

## Composition intent

- Pattern grammar SHOULD remain small and composable so higher-level language
  layers can build declarations, imports, and expression-bearing wrappers on top
  of it.
- Pattern grammar MAY introduce surface sugar only when that sugar normalizes
  deterministically to the canonical pattern tree.
- Pattern grammar SHOULD keep the runtime pattern vocabulary visible in the
  source form so grammar authors can reason about matching behavior directly.
