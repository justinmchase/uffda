---
id: cli-language-server-005
title: Semantic-token highlighting is derived from the grammar's own delivered parse tree and [token] metadata
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
  tree and its `[token]` rule-metadata (see GitHub issue #159), not from a
  separately hand-maintained TextMate-style grammar or regex classifier. A rule
  with no `[token]` metadata applied MUST NOT itself emit a semantic token,
  though its matched span MAY still contribute to an ancestor/descendant rule's
  token.
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
