---
id: runtime-core-009
title: Derived scopes share their stack frames and options with the scope they derive from
spec_ref: ".agents/specifications/runtime/scopes.spec.md#structural-sharing-of-derived-scopes"
---

# Derived Scopes Share Structure

## Requirement

Preconditions:

- A scope is derived from another scope (by pushing a rule, pipeline, or module
  frame, advancing the input, adding variables, or swapping memos).

Expected behavior:

- Pushing a frame MUST produce a stack whose depth is one greater and whose
  frames below the new top are the parent's frames, shared rather than copied.
- A derived scope whose options are unchanged MUST reference the same options
  object as the scope it derives from.
- Scopes produced during a parse MUST all share the root scope's options object.

Postconditions:

- Memory retained by a parse result does not grow with the product of match
  count and rule nesting depth.
