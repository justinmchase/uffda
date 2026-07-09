# Pattern syntax contracts

This chapter defines the syntax contract for pattern bodies that appear on the
right-hand side of a pattern declaration.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Scope boundary

- This chapter covers only the pattern body itself.
- Pattern declarations, import statements, export statements, and other
  higher-level wrapper syntax are out of scope for this chapter.
- Expression syntax is also out of scope for this chapter; when a higher layer
  embeds expressions inside a pattern declaration, that embedding is governed by
  the higher layer rather than by the pattern grammar itself.

## Layer position and integration

- Pattern syntax MUST execute after source normalization and tokenization in the
  default language stack.
- Pattern syntax MUST consume tokenizer output without redefining token boundary
  semantics.
- Pattern syntax MUST remain reusable as the body language for higher-level
  declaration systems.
- Higher-level language wrappers that expose a complete pattern source parser
  MUST enforce full-input consumption after parsing a pattern body.

## Syntax goals

- Pattern syntax SHOULD be intentionally low-sugar and structurally explicit.
- Pattern syntax SHOULD prefer deterministic, machine-friendly forms that map
  cleanly to pattern runtime kinds.
- Pattern syntax MUST NOT introduce statement-like control flow such as `if`,
  `else`, `let`, `return`, or loop syntax.
- Pattern syntax MUST preserve ordered composition and child grouping when a
  pattern form delegates to nested patterns.

## Canonical pattern model

- A pattern body MUST normalize to a single canonical pattern tree.
- Every syntactic form MUST map to a well-defined pattern runtime contract.
- The syntax layer MUST preserve child order for ordered composition forms.
- The syntax layer MUST preserve nesting boundaries for grouping, traversal, and
  delegation forms.

## Composition operator policy

- Alternation MUST use the `|` symbol.
- Conjunction MUST use the `&` symbol.
- Keyword aliases for alternation and conjunction MUST NOT be accepted as
  operator spellings.
- Alternation MAY start with an optional leading `|` so vertically aligned
  alternatives remain valid and canonical.

## Subtopics

- [pattern grammar](./pattern-syntax/grammar.spec.md)

## Composition intent

- Pattern syntax SHOULD be reusable by non-Uffda declaration layers that still
  rely on the same matching runtime.
- Future pattern syntax extensions SHOULD remain compatible with the canonical
  pattern tree model established by this chapter.
