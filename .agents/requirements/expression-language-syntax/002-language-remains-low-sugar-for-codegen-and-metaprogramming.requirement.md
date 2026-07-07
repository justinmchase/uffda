---
id: expression-language-syntax-002
title: Expression language remains intentionally low-sugar for code generation and metaprogramming
spec_ref: ".agents/specifications/languages/expression-layer.spec.md#language-design-goals"
---

# Low-sugar Language Design

## Requirement

Preconditions:

- Expression-language syntax evolves to support language-level authoring and
  generated code.

Expected behavior:

- Expression syntax MUST remain explicit and low-sugar.
- Syntax additions SHOULD prioritize code generation determinism and
  machine-friendly structure over authoring convenience sugar.

Postconditions:

- Expression syntax remains simple, inspectable, and stable for generation and
  transformation workflows.
