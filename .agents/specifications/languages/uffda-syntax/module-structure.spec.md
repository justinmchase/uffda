# Module structure syntax

This chapter defines the top-level document structure for Uffda module source.

## Logical purpose

Module structure syntax declares the ordered set of top-level declarations that
form one Uffda module.

## Syntax boundary

- A Uffda module document MUST parse as an ordered sequence of top-level
  declarations.
- The module document boundary MUST require full-input consumption.
- Empty module documents MAY be supported during bootstrap scaffolding.

## Declaration envelope

- Top-level declarations MUST be classified as import, export, or rule
  declarations.
- Every top-level declaration MUST begin with a distinct declaration keyword
  token that identifies its declaration family.
- Declaration order MUST be preserved in the canonical syntax tree.
- Future declaration families MUST be introduced as explicit top-level forms
  rather than overloaded into existing declaration grammar.

## Declaration keyword model

The Uffda declaration surface uses keyword-headed forms so declaration parsing
remains deterministic and extensible.

```
rule Declaration<Keyword Pattern> = Keyword Pattern ';' ;
```

- The `Keyword` position MUST be a declaration-family discriminator.
- Distinct declaration families MUST NOT share the same leading keyword.
- Declaration bodies MUST be parsed according to the declaration family selected
  by the leading keyword.

## Composition intent

- Module structure syntax SHOULD remain deterministic and tooling-friendly.
- The module envelope SHOULD provide stable positions for diagnostics,
  formatting, and source-to-source transforms.
