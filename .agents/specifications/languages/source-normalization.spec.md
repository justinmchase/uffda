# Source normalization and source-context indexing

This chapter defines source-entry normalization and source-context indexing
contracts for language stacks built with Uffda.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

Source normalization prepares raw source values for tokenization while
preserving deterministic source-position identity for diagnostics and debugging.

## Layer position and integration

- Source normalization and indexing MUST execute as a dedicated pipeline step
  immediately before tokenization in the default language stack.
- The canonical default pipeline shape MUST be:
  `SourceNormalizationAndIndex -> Tokenizer -> Expression`.
- Tokenization MUST consume normalized indexed source produced by this layer,
  not raw source text directly.

## Required pattern module

The source-normalization layer MUST be representable as a module with a default
rule named `SourceNormalizationAndIndex`.

### Required module exports

- `SourceNormalizationAndIndex` (default rule): entrypoint that consumes raw
  source and produces normalized indexed source.
- `SourceDocument`: rule that validates and/or constructs the structured source
  document contract.
- `NormalizedText`: rule that produces normalized text.
- `LineIndex`: rule that produces deterministic line-start index metadata.
- `UnitIndex`: rule that produces deterministic source-unit index metadata.

### Required entry rule shape

- `SourceNormalizationAndIndex` MUST be a pipeline composition rule.
- It MUST execute, in order:
  1. Source payload validation/coercion.
  2. Text normalization.
  3. Line indexing.
  4. Unit indexing.
  5. Source document assembly.
- The rule output MUST be a `SourceDocument` value.

## Required data contracts

### SourceDocument

`SourceDocument` MUST include:

- `documentId`: deterministic identifier for diagnostics and trace correlation.
- `text`: normalized text payload.
- `lineStarts`: ordered list of line-start offsets for normalized text.
- `units`: ordered list of source units covering the normalized text.
- `normalizationMap`: mapping from normalized offsets to original offsets.

### SourceUnit

Each `SourceUnit` MUST include:

- `index`: stable unit index in document order.
- `value`: normalized unit value.
- `offsetStart` and `offsetEnd`: normalized offsets.
- `lineStart` and `columnStart`: normalized line/column start location.
- `lineEnd` and `columnEnd`: normalized line/column end location.
- `originalOffsetStart` and `originalOffsetEnd`: source offsets prior to
  normalization.

### Normalization map

- The normalization map MUST support deterministic provenance lookup from any
  normalized offset range back to original source offsets.
- The map MUST remain valid under all required normalization transforms in this
  chapter.

## Normalization requirements

- Source-entry normalization MUST produce deterministic normalized source
  structures for fixed input.
- Normalization MUST preserve enough source identity to support exact location
  reporting in downstream layers.
- Normalization MUST NOT introduce newline-sensitive or indentation-sensitive
  semantics in default bootstrap layers.

### Required normalization transforms

- Line endings MUST normalize to a canonical representation.
- Normalization MUST preserve semantic content needed by tokenization, including
  whitespace characters used as separators.
- Normalization MUST NOT collapse or reinterpret whitespace in ways that change
  tokenizer-visible boundaries.
- Normalization MUST preserve an exact provenance mapping for any changed offset
  layout.

## Source-context indexing requirements

- Source-context indexing MUST provide stable positional references for
  tokenization and later provenance mapping.
- Indexed source context SHOULD support exact failure reporting without relying
  on layer-local heuristics.

### Required indexing invariants

- `lineStarts` MUST be strictly monotonic and cover all line boundaries in
  normalized text.
- `units` MUST cover the full normalized text without overlap or gaps.
- Unit order MUST correspond to normalized text order.
- Offset-to-line/column and line/column-to-offset lookups MUST be deterministic
  for fixed normalized text.

## Error and diagnostics requirements

- Source-normalization failures MUST produce explicit diagnostics with source
  provenance.
- Diagnostic payloads produced by this layer MUST include source ranges that can
  be mapped to original source.
- This layer MUST NOT discard context needed for downstream token, pattern, or
  expression diagnostics.

## Pattern composition requirements

- Required source-normalization rules SHOULD be composable by other language
  stacks as reusable lower-layer building blocks.
- Rule boundaries in this layer SHOULD remain explicit so downstream stacks can
  replace or extend individual steps (for example alternate normalization
  policy) without redefining all lower-layer contracts.

## Composition intent

- Source normalization contracts SHOULD be reusable by alternate language stacks
  that only consume tokenizer/lower-layer outputs.

## Standard library helpers (bootstrap precursors)

Language modules MUST be able to assemble source documents without permanent
TypeScript `Native` host helpers once these std globals ship. Authors invoke
them as ordinary invocations (for example `(sha256 text)`).

These globals are **bootstrap precursors**. Several encode source-stack
contracts and are a provisional fit for shared std; the long-term home is
expected to be module-local author-defined functions once that surface exists
(see [#124](https://github.com/justinmchase/uffda/issues/124)). Until then,
implementations MUST keep these names and contracts stable for language-module
conversion.

### Pure std (no match injection)

| Name                | Contract                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| `sha256`            | SHA-256 digest of a string, as raw bytes                                |
| `base58`            | Base58 (Bitcoin alphabet) encoding of bytes                             |
| `slice`             | Slice of a string or array (JS `slice` semantics: exclusive end)        |
| `length`            | Length/size of a string, array, Set, or Map                             |
| `line_starts`       | Ordered normalized line-start offsets for a string                      |
| `units`             | Ordered `SourceUnit` rows from text, lineStarts, and normalizationMap   |
| `document_id`       | Stable `source:{length}:{digest}` identifier                            |
| `normalized_unit`   | `{ value, originalOffsetStart, originalOffsetEnd }`                     |
| `normalization_map` | Map from ordered normalized units (ends with final original end offset) |
| `iterable`          | Normalizes any `Symbol.iterator`/`Symbol.asyncIterator` value to async  |

`sha256`, `base58`, `slice`, `length`, `units`, and `iterable` are runtime
globals; `line_starts`, `document_id`, `normalized_unit`, and
`normalization_map` are module-local `func` declarations in
`src/lang/source/mod.uff` composed from those globals (for example `document_id`
is `"source:{(length text)}:{(slice (base58 (sha256 text)) 0 8)}"` via string
interpolation — `sha256` is async, but ExpressionLang invocations already await
nested calls end-to-end, so no special syntax is needed).

`source_document`-shaped values (e.g. `SourceDocument`) are assembled directly
as object literals using computed keys and the `iterable` global — for example
`{ ...(iterable t), documentId: (document_id t), text: t, ... }` — rather than a
dedicated constructor global.

### Match-aware std

| Name                | Contract                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `match_leaf_offset` | Numeric leaf path segment of the current match span (`"start"` / `"end"`) |

Match-aware callables are ordinary std globals marked for match injection.
Invocation MUST inject the current successful `MatchOk` as the first argument
before author-supplied arguments (see
[invocation](../expressions/invocation.spec.md#match-aware-invocation)). Authors
write `(match_leaf_offset "start")` — they MUST NOT pass the match value
themselves.
