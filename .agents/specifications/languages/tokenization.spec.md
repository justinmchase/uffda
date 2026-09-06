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

## Comment trivia

- Outside quoted strings, `#` MUST begin a line comment that extends to the next
  canonical newline or end of input.
- A `#` inside a quoted string MUST remain ordinary string content.
- Comment text MUST NOT be emitted as semantic tokens to downstream expression,
  pattern, or declaration parsers.
- Removing a line comment MUST preserve the canonical newline boundary and its
  source provenance for diagnostics and optional trivia consumers.
- Recognition of `#` comments MUST be unconditional and MUST NOT depend on the
  character that follows `#`.

## Structured tokens and trivia

- Token rule projections MUST contain only token kind and text. Source spans
  MUST NOT appear on AST or token values.
- Every successful, failed, and error Match result MUST carry a normalized
  source span and an original source span derived from the matched stream and
  any attached source-normalization map.
- Rule expressions MUST NOT read, write, or copy source spans; provenance is
  attached by the runtime Match constructors.
- The tokenizer SHOULD expose lossless token kind/text including comment and
  whitespace trivia, in addition to the semantic token texts used by parsers.
- Comments and whitespace MUST be representable as trivia without becoming
  semantic parser tokens.
- Trivia attachment policy (leading, trailing, or detached) MUST be explicit and
  deterministic.
- Comment recognition and string-literal boundaries MUST be expressed through
  tokenizer patterns rather than a host-language state machine.

## Escape sequences in quoted strings

- Inside a quoted string, `\` MUST introduce an escape that consumes exactly one
  following source character (not a greedy word or whitespace run).
- The escape introducer and its single follower MUST both remain visible to
  no-whitespace semantic consumers (for example as punctuation texts) so
  PatternLang can interpret `\t`, `\n`, `\r`, `\\`, and `\"`.
- Unescaped whitespace and newlines inside quotes remain trivia and MUST NOT
  appear in the no-whitespace semantic stream.

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

## Delivery milestone: Tokenizer trivia and source spans

- Attach normalized and original source spans to every Match result in the
  runtime. Do not embed spans in rule projections. (delivered)
- Preserve comments and whitespace as lossless trivia while retaining the
  current semantic token stream for parser compatibility. (delivered)
- Propagate token and normalization provenance through `pipeline` and `into` so
  diagnostics can use `Match.originalSpan` without heuristic repair. (delivered)
- Replace host-language comment/string filtering with composable Uffda lexer
  patterns. (delivered)
- Verify that expression, pattern, and Uffda grammar results remain unchanged
  for existing inputs. (delivered)
