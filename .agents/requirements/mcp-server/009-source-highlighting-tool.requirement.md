---
id: mcp-server-009
title: Source highlighting is derived from AST/span classification, not raw lexical token kinds
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#source-highlighting-tool"
---

# Source Highlighting Tool

## Requirement

Preconditions:

- Uffda (or a sub-language's: pattern, expression) source text is provided to
  the highlighting tool, either standalone or against an already-loaded session
  module.

Expected behavior:

- The tool MUST classify spans of the source by syntactic role (at minimum:
  keyword, identifier, string literal, comment, punctuation) rather than only
  the tokenizer's coarse lexical kinds (`Word`/`Whitespace`/`Punctuation`/
  `Comment`/`NewLine`), since those do not distinguish, for example, a `rule`
  keyword from an ordinary identifier.
- Classification MUST be derived from the same parse/AST span information used
  for diagnostics elsewhere in the system (not a separately maintained
  regex/heuristic classifier that could silently diverge from actual parse
  results).
- The tool MUST return a representation an agent can render directly for a human
  to read (for example ANSI-annotated text or a span list with
  role/offset/length), covering the entire input source with no gaps.
- Source that fails to parse MUST still return a best-effort classification for
  the portion that parsed successfully, plus the same diagnostic information a
  parse failure would otherwise produce.

Postconditions:

- The same source, parsed twice, produces identical highlighting output.
