---
id: mcp-server-006
title: Evaluation runs against a session's live resolved state, including decorator-derived metadata
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#evaluation-tools"
---

# Evaluation Tool

## Requirement

Preconditions:

- A session has at least one loaded module (004).
- An expression, or a named rule/func invocation with arguments, is provided
  against that session.

Expected behavior:

- The tool MUST evaluate the expression, or invoke the named rule/func, using
  the session's already-resolved state (rules, funcs, decorators, applied
  attributes/metadata) without re-parsing or re-resolving any loaded module from
  source.
- The tool MUST return a structured result including at minimum the match kind
  (Ok/Fail/Error), the resulting value when applicable, and source span
  information when the evaluated target has one.
- For a rule/func invocation, the tool MUST retain the full match result tree in
  the session and return a stable result id referencing it, rather than
  returning the full tree inline or discarding it once the top-level value is
  extracted. The retained tree is what the match-tree walking tool (008)
  traverses; a match result tree can be arbitrarily large, so eagerly returning
  or flattening it here would defeat that tool's response-size budget.
- Invoking a rule/func by a name that does not resolve in the session MUST fail
  deterministically with the same error shape as other unresolved-reference
  failures.
- Evaluation MUST reflect any metadata produced by decorator application (see
  `.agents/specifications/runtime/rule-metadata.spec.md`) — for example, a
  rule's `metadata` MUST be inspectable via the introspection tools (007) using
  the exact keyed values produced by loading, without re-deriving them.

Postconditions:

- Repeated evaluation calls against an unchanged session produce identical
  results.
