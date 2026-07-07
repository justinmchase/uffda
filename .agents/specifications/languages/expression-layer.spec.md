# Expression layer contracts

This chapter defines expression-layer contracts when expressions are used as a
reusable language stack layer.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The expression layer provides deterministic projection and value-construction
semantics for higher language-definition layers.

## Layer position and integration

- Expression parsing MUST execute after source normalization and tokenization in
  the default language stack.
- The canonical default pipeline shape MUST be:
  `SourceNormalizationAndIndex -> Tokenizer -> Expression`.
- Expression syntax MUST consume tokenizer output contracts without redefining
  tokenizer boundary semantics.

## Language design goals

- Expression language syntax MUST be intentionally low-sugar and simple.
- Syntax design SHOULD prioritize deterministic code generation and
  meta-programming, including object interpolation workflows.
- New syntactic sugar SHOULD NOT be added unless it preserves unambiguous,
  machine-friendly code generation semantics.

## Layer requirements

- Expression-layer semantics MUST compose over tokenized and/or pattern-derived
  inputs without redefining lower-layer token contracts.
- Expression evaluation MUST preserve source provenance mapping for diagnostics
  and failure attribution.
- Expression-layer contracts SHOULD remain syntax-minimal and reusable by
  alternate language stacks.

## Integration requirements

- Expression outputs MUST be consumable by pattern and language-definition
  layers through stable value contracts.
- Expression failures MUST remain diagnosable with mapped source context.

## Syntax governance requirements

- Every expression-language syntax subtopic MUST define valid, non-conflicting
  grammar forms.
- Expression-language feature syntax MUST be unambiguous for fixed tokenizer
  output.
- Feature syntax forms MUST avoid overlap that would require ambiguous parse
  tie-breaking.

## Surface and canonical syntax policy

- Expression language MAY expose limited surface sugar for human readability.
- Expression language MUST define one canonical normalized expression form for
  downstream compilation and metaprogramming.
- Surface forms MUST desugar deterministically into canonical forms.
- Binary infix surface forms are allowed when they preserve deterministic
  precedence and associativity and normalize to canonical operator-head forms.
- Array/object structuring MAY expose minimal JavaScript-style sugar (`[]` and
  `{}`) when it normalizes deterministically to canonical structuring forms.
- Canonicalization MUST occur at parse boundaries before later compilation
  stages.

## Expression syntax sub-specs

- [literal and terminal syntax](./expression-syntax/literals-and-terminals.spec.md)
- [grouping and sequence syntax](./expression-syntax/grouping-and-sequence.spec.md)
- [array and object structuring syntax](./expression-syntax/array-and-object-structuring.spec.md)
- [function invocation syntax](./expression-syntax/function-invocation.spec.md)
- [unary operator syntax](./expression-syntax/unary-operators.spec.md)
- [binary operator syntax](./expression-syntax/binary-operators.spec.md)
- [string and interpolation syntax](./expression-syntax/string-and-interpolation.spec.md)

## Composition intent

- Expression layer reuse SHOULD support language consumers that build custom
  top-level grammar layers over shared expression semantics.
