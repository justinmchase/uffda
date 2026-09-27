---
id: cli-language-server-005
title: Semantic-token highlighting is derived from the grammar's own delivered parse tree and [Token] metadata
spec_ref: ".agents/specifications/languages/cli/language-server.spec.md#syntax-highlighting"
---

# Syntax Highlighting

## Requirement

Preconditions:

- A document has been opened or changed (003) and parsed at least partially
  successfully (a syntax error in one region MUST NOT prevent highlighting of
  unaffected regions).

Expected behavior:

- The server MUST support `textDocument/semanticTokens` (full-document and, if
  the editor requests it, delta/range variants) for every configured language.
- Token classification MUST be derived from the grammar's own delivered parse
  tree and its decorator-derived rule metadata, not from a separately
  hand-maintained TextMate-style grammar, a regex classifier, or a map of rule
  names. The classification sources are `[Highlight { role }]` on token rules
  and `[Keyword]` (see
  [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md#highlighting)):
  token spans are the innermost `Highlight`-annotated nodes, each taking the
  role of the outermost `Highlight` on its path, and name-refinement roles
  (`type`, `function`, `variable`, `property`) reclassify the identifiers within
  the outermost node annotated with one. A `variable` name MUST then be
  classified by what the document session resolves it to (a local binding stays
  `variable`, a rule or decorator is `type`, a func or runtime global is
  `function`; see
  [editor metadata](../../specifications/languages/cli/editor-metadata.spec.md#highlighting)),
  without mutating session state. Roles MUST map to the standard LSP token types
  of the same names (`identifier` to `variable`, `punctuation` to `operator`),
  so editor themes color them with no extension-side theme contribution. A rule
  with no applicable classification metadata MUST NOT itself emit a semantic
  token, though its matched span MAY still contribute to an ancestor/descendant
  rule's token.
- Highlighting MUST stay current under `didChange` using the same
  document-synchronization contract diagnostics use (003/004): a region whose
  underlying parse was reused via incremental re-parsing MUST report the same
  token classifications it reported before the edit, for spans outside the
  affected region.
- A parse failure MUST NOT blank out highlighting for the entire document;
  regions of the document already matched by a stabilized memo entry before the
  point of failure MUST retain their token classifications.

Postconditions:

- Highlighting for any open document is always derivable from — and consistent
  with — that document's current parse tree, with no separate/parallel
  highlighting-specific parse pass required.
