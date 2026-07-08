---
id: expression-language-syntax-010
title: Expression syntax excludes statement-like branching and binding while pattern layer owns branching semantics
spec_ref: ".agents/specifications/languages/expression-layer.spec.md#language-design-goals; .agents/specifications/languages/expression-layer.spec.md#integration-requirements; .agents/specifications/languages/pattern-layer.spec.md#high-level-principles"
---

# Pattern-owned Branching and Binding Boundary

## Requirement

Preconditions:

- Expression and pattern layers are composed in the default language stack.

Expected behavior:

- Expression syntax MUST NOT add statement-like `if`/`else`, `let`, loop, or
  `return` constructs solely to encode branch selection and local binding.
- Branch selection, guard-style constraints, equality-like checks, and local
  variable capture SHOULD be modeled through pattern forms.
- Expression projection syntax and pattern branching semantics MUST remain
  separated by layer responsibilities.

Postconditions:

- The expression layer remains low-sugar and projection-focused while the
  pattern layer remains the primary branching and binding mechanism.
