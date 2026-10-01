---
id: runtime-core-010
title: Inline argument patterns see the caller's variables; declared rules do not
spec_ref: ".agents/specifications/runtime/scopes.spec.md#lexical-visibility-of-rule-and-func-bodies"
---

# Argument Patterns Close Over the Caller's Scope

## Requirement

Preconditions:

- A rule references a parameterized rule, passing an argument pattern.

Expected behavior:

- An inline argument pattern MUST resolve the caller's variables bound before
  the reference, such as `Show<(ok -> (add (length x) 1))>` after `x:string`.
- An inline argument pattern MUST still resolve the caller's bound rule
  arguments.
- A variable bound inside an inline argument pattern MUST NOT be visible to the
  invoked rule's own body or to the caller after the reference.
- A declared rule passed by bare name MUST NOT see the caller's variables: a
  reference to a caller variable from its body MUST report an unknown-reference
  error.

Postconditions:

- A declared rule's body behaves the same wherever it is invoked.
