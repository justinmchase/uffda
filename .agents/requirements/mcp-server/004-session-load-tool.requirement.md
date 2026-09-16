---
id: mcp-server-004
title: Loading a module into a session reports partial resolvability and, on success, its exported members
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#session-lifecycle-tools"
---

# Session Load Tool

## Requirement

Preconditions:

- A session is open.
- A source file path or inline source is provided to a "load" tool call against
  that session.

Expected behavior:

- Loading MUST parse, compile, and resolve the given source against the
  session's resolver, adding it (and any modules it imports) to the session's
  module graph.
- Before resolve, loading MUST ensure every transitive file:// `.uff` import has
  a compiled ModuleDeclaration artifact under the session's artifact root
  (default `.uffda`, overridable via the session's runtime `artifactRoot` option
  — not via LSP config and not by assuming `./bin`). When an artifact is missing
  or older than its source, and the source file exists, the session MUST compile
  that source into the artifact root. When the source file is absent, the
  session MUST leave the failure to the resolver so earlier imports in the same
  load can still contribute to partial-success reporting. The resolver remains
  read-only over JSON artifacts (see compiler-bootstrap); compile-on-demand is a
  session responsibility.
- If loading fails at any stage (parse, compile, or resolution), the tool MUST
  report which stage failed and MUST still report any information that was
  successfully resolved prior to the failure (for example, a resolvable import's
  own exports), rather than only reporting the failure with no other context.
- On success, the tool MUST report the loaded module's exported rules, funcs,
  and decorators (name and kind, at minimum).
- Loading the same file path again in the same session MUST be well-defined:
  either it MUST update the existing loaded module's state in place, or it MUST
  fail deterministically if re-loading an already-loaded path is unsupported —
  implementations MUST pick one and document it consistently with the
  incremental re-parse tool's semantics (005).

Postconditions:

- After a successful load, the session's introspection tools (007) can
  immediately list and describe the newly loaded module's declarations.
