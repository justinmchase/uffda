---
id: mcp-server-007
title: Introspection tools reflect current session state and support querying declarations by decorator metadata
spec_ref: ".agents/specifications/languages/cli/mcp-server.spec.md#introspection-and-query-tools"
---

# Introspection and Query Tools

## Requirement

Preconditions:

- A session has at least one loaded module (004), possibly patched by
  incremental re-parse (005).

Expected behavior:

- A "list modules" tool MUST report every module currently loaded in the session
  and each module's exported rules, funcs, and decorators.
- A "describe declaration" tool MUST, given a module and a rule/func/decorator
  name, return that declaration's pattern/expression structure and parameters,
  and — for rules/funcs — its applied attributes (decorator name, evaluated
  args) and keyed metadata (decorator name -> that decorator's return value).
- A "query by metadata" tool MUST, given a decorator name (and optionally a
  predicate over that decorator's metadata value), return every rule/func in the
  session whose metadata contains a matching entry, across all loaded modules in
  that session.
- All introspection tools MUST reflect the session's current state, including
  the effect of any incremental re-parse already applied and any evaluation that
  mutated no state (introspection itself MUST be read-only and MUST NOT change
  session state).
- Describing or querying against an unknown module or declaration name MUST fail
  deterministically rather than returning an empty or guessed result.

Postconditions:

- An agent can discover "every rule decorated with X" without knowing module
  structure in advance, and can retrieve a specific declaration's full metadata
  without re-evaluating anything.
