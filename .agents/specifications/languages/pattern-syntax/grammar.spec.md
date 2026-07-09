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
- Expressions MAY be referenced only by higher layers that combine pattern
  bodies with expression-bearing declaration forms.

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
      aliases: [quantifier any (1,)],
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
