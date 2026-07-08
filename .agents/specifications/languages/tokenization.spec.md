# Tokenization and token model boundaries

This chapter defines tokenization-layer contracts, including lexeme discovery,
token boundaries, and source-span preservation.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

Tokenization converts normalized source context into deterministic token streams
that can be consumed by expression, pattern, and language-definition layers.

## Layer position and integration

- Tokenization MUST execute after source normalization and indexing in the
  default language stack.
- The canonical default pipeline shape MUST be:
  `SourceNormalizationAndIndex -> Tokenizer -> Expression`.
- Tokenization MUST consume normalized indexed source structures and MUST NOT be
  responsible for canonicalizing mixed source newline encodings.

## Tokenization requirements

- Tokenization MUST be pattern-matchable and composable with downstream layers.
- Tokenization MUST preserve stable source spans for emitted tokens.
- Tokenization MUST support default bootstrap whitespace rules that require at
  least one separator where grammar requires separation.
- Tokenization MUST NOT require newline-sensitive or indentation-sensitive rules
  in the default bootstrap stack.

### Required tokenizer module shape

- The tokenizer layer MUST be representable as a module with default rule
  `Tokenizer`.
- The module SHOULD provide composable token rules for whitespace, newline,
  word-like, and punctuation token forms.
- In the default stack, `NewLineToken` MUST match canonical `"\n"` and MUST NOT
  directly recognize `"\r"` or `"\r\n"`; this behavior belongs to source
  normalization.

### Input and output contracts

- Tokenizer input in the default stack MUST be the normalized iterable surface
  produced by `SourceDocument`.
- Tokenization MUST produce deterministic token streams for fixed normalized
  input and tokenizer configuration.
- For fixed input and fixed normalization map, token boundaries SHOULD be
  reconstructable against source-unit indexes without heuristic repair.

## Interpolation boundary requirements

- Tokenization MUST preserve interpolation delimiter boundaries used by
  downstream expression parsing (for example `"`, `$`, `{`, `}`, `.`, and `:`).
- Tokenization MUST NOT collapse quoted string regions into a single token when
  that would hide interpolation boundaries.
- Tokenization MUST preserve object-interpolation punctuation and nesting
  delimiters as independently tokenizable units so downstream layers can
  distinguish object literals from interpolation wrappers.
- Tokenization SHOULD leave interpolation semantic interpretation to
  expression/pattern layers; tokenizer responsibility is deterministic boundary
  emission and provenance-preserving segmentation.

## Token model requirements

- Token model contracts SHOULD separate semantic tokens from optional trivia
  channels while preserving source provenance.
- Token model outputs MUST remain deterministic for fixed source and tokenizer
  configuration.

## Error and negative behavior requirements

- Tokenizer MUST fail (non-error) when input does not satisfy tokenizer pattern
  contracts.
- Tokenizer MUST NOT silently coerce non-tokenizable input values into token
  strings.
- Tokenizer failures SHOULD preserve source context needed for downstream
  diagnostics.

## Composition intent

- Tokenization contracts SHOULD be reusable by consumers that do not use Uffda
  language-definition layers.
