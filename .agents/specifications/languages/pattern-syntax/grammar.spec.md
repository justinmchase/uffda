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
- Line breaks between tokens MUST NOT be semantic: wherever whitespace may
  separate two tokens, a line break MUST parse the same as a space.

## Pattern families

The grammar MUST be able to express the following pattern families:

- primitive matchers, including `any`, `end`, `ok`, `fail`, bare literal
  equality, reserved type keywords, Unicode property classes, membership
  (`in[...]`), and `variable`; `between`, and `quantifier`;
- traversal and delegation forms, including `into`, `over`, `pipeline`, and
  `resolve`;
- boundary and lookaround forms, including `lookahead`;
- committed-choice dispatch, via `switch`;
- non-contributing matches, via `skip`;
- error recovery points, via `ope … sneak by …`;
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
- The grammar MAY allow a leading `|>` before the first pipeline step. A leading
  `|` followed by `>` MUST be read as a leading `|>`.

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
- A maximum less than its minimum on digit–digit star bounds (`P*2..1`) MUST be
  rejected at parse time via open-upper between (`number & $n..`). Variable or
  mixed bounds MAY still parse; the
  [quantifier](../../patterns/runtime/quantifier.spec.md) runtime MUST reject
  invalid resolved bounds when evaluated.
- Shorter postfix `*` arms MUST NOT succeed on a proper prefix of a longer star
  form: after `P*min..` reject a following bound token; after `P*min` reject
  following `..`; after bare `P*` reject a following bound or `.`.
- Repetition suffixes MUST NOT be chained.
- Bounds immediately following `*` MUST belong to that repetition regardless of
  intervening whitespace. Authors MUST group an unbounded repetition before
  sequencing it with a numeric literal, as in `(P*) 1`.

## Object patterns

- An object pattern MUST use `{ key: P, ... }`, where each named entry checks
  the value at that property using pattern `P`.
- An object pattern MAY include one or more ordered rest clauses:
  - `...[P]: V` matches each remaining entry whose key matches `P`, then
    requires its value to match `V`.
  - `...name:[P]: V` additionally captures each claimed entry as a
    `[key,
    value]` pair in `name`.
  - `...ope` accepts all entries left unmatched by earlier clauses and MUST be
    the final rest clause.
- Variable captures in the key or value pattern of a rest clause MUST collect
  the captured value from every entry claimed by that clause into an array,
  preserving entry order. If no entries are claimed, those variables MUST remain
  unbound.
- The optional entry capture name before a rest clause MUST collect the claimed
  entry's `[key, value]` pair into an array, preserving entry order. If no
  entries are claimed, the variable MUST remain unbound.
- A rest clause MUST inspect only entries not declared by named fields or
  claimed by earlier rest clauses.
- A key- or value-pattern miss MUST leave that entry available to later clauses.
- When no final `...ope` is present, every entry not claimed by a pattern rest
  clause MUST cause the object pattern to fail.
- The key and value patterns MUST each be full patterns, delimited by `[` and
  `]` around the key pattern and `:` between the key and value patterns.
- Rest clauses MUST normalize to an ordered `over.rest` list, preserving each
  key/value clause, optional entry capture name, and optional final catch-all.

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

## Switch case dispatch

- Committed-choice dispatch MUST use the spelling
  `switch { case, ..., default: P }`, normalizing to the
  [switch](../../patterns/runtime/switch.spec.md) runtime pattern.
- Each case MUST be written `key: P`, where `key` is either a comma-separated
  list of value-source keys (`ContextualValue` or a bare/literal value, but not
  a bare identifier reference) or a single Unicode character class, and `P` is
  that case's body pattern.
- `switch` and `default` MUST be reserved keywords: they MUST NOT be accepted as
  bare rule-reference identifiers, so that a bare `default` token can never be
  parsed as a case's literal-value key instead of the default marker.
- `default: P`, if present, MUST be the last entry in the `switch` body.
- The `switch` body MAY declare zero cases (with or without `default`).
- Cases and `default` MUST be separated by `,`. A single trailing `,` before the
  closing `}` MUST be accepted.
- Case order in source MUST be preserved as declared-order dispatch priority in
  the normalized `switch` pattern.

## Skip

- `skip P` MUST normalize to the [skip](../../patterns/runtime/skip.spec.md)
  runtime pattern with child `P`. `skip` is a prefix operator: `P` binds as a
  prefix operand, so `skip P*` skips the whole repetition and `skip v:P` skips
  the capture.
- A bare `skip` (not followed by a prefix operand) MUST normalize to the `skip`
  pattern with an `any` child, skipping exactly one item.
- `skip` MUST be a reserved keyword: it MUST NOT be accepted as a bare
  rule-reference identifier. A rule named `skip` remains referenceable as
  `@skip`.

## Recovery

- `ope P sneak by S` MUST normalize to the
  [recover](../../patterns/runtime/recover.spec.md) runtime pattern with child
  `P` and skip pattern `S`. `P` and `S` each bind as a prefix operand, so
  `ope a:Stmt sneak by (not ";" any)+` recovers the capture and skips the
  repetition.
- `ope P sneak by until T` MUST normalize to the `recover` pattern whose skip
  pattern matches one or more items that do not start `T` (a quantifier with
  minimum 1 over `not T` followed by `any`), so the recovery stops before `T`
  without consuming it and never swallows a parent's terminator.
- `ope`, `sneak`, and `until` MUST be reserved keywords: they MUST NOT be
  accepted as bare rule-reference identifiers. Rules with those names remain
  referenceable as `@ope`, `@sneak`, and `@until`.

## Recovery points

The pattern grammar itself declares these recovery points (see
[runtime error recovery](../../runtime/error-recovery.spec.md)). Each skips the
erroneous tokens and contributes nothing to the pattern AST.

- After a sequence's first element, a token that does not start an element MUST
  be skipped, unless it is a delimiter an enclosing construct consumes: `)`,
  `]`, `}`, `|`, `&`, `-`, `>`, `,`, `:`, or a comment node (see
  [Comments](#comments)).
- Tokens left over after a complete pattern MUST be skipped through the end of
  the input.

## Comments

A host grammar that keeps comments (for example the
[Uffda module grammar](../uffda-syntax/module-structure.spec.md#comments)) turns
each run of comments on their own lines into one comment node before the pattern
grammar runs. The pattern grammar accepts comment nodes as members of the
pattern lists. Where a comment node may appear depends only on its position
between the surrounding tokens, never on the comment's text:

- In an alternation, comment nodes MAY appear before the first alternative,
  immediately before the `|` that starts any later alternative, and after the
  last alternative when it is followed by `)`, `]`, `}`, `>`, or the end of the
  pattern.
- In a conjunction, comment nodes MAY appear immediately before any `&`. In a
  pipeline, immediately before any `|>`. In an ordered sequence, between any two
  elements.
- A comment node MUST be kept in the list where it appears, in source order, as
  `{ kind: "comment", blocks }`. An alternation that holds a comment node MUST
  NOT collapse to its single alternative, so leading or trailing comments stay
  in the tree; removing comments (see
  [runtime compilation](../uffda-runtime-compilation.spec.md#compilation-boundary))
  collapses it afterwards.
- A comment node anywhere else in a pattern MUST be a syntax error.

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

The following style is valid when leading `|>` pipelines are enabled:

```uff
Example =
  |> Source
  |> [Tokens]
  |> [Module]
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
