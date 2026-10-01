---
id: runtime-core-011
title: Func bodies see only their own parameters and declaring module
spec_ref: ".agents/specifications/runtime/scopes.spec.md#lexical-visibility-of-rule-and-func-bodies"
---

# Func Bodies Are Lexically Scoped

## Requirement

Preconditions:

- A rule or func invokes a module func, possibly one imported from another
  module.

Expected behavior:

- A func parameter MAY reuse the name of a variable bound in the caller; the
  invocation MUST bind the parameter without a duplicate-variable error.
- A func body MUST NOT resolve a caller's variable: a reference to a name bound
  only in the caller MUST raise an unknown-reference error.
- An imported func's body MUST resolve funcs from its declaring module, even
  when the invoking module does not import them.
- A lambda MUST still resolve variables bound where it is written.
- A func or lambda whose arguments do not match its parameter pattern MUST raise
  an expression exception at the call site rather than returning a value.

Postconditions:

- A func behaves the same wherever it is invoked.
