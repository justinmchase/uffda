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
