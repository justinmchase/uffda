---
id: expression-language-syntax-001
title: Expression feature syntax forms are non-conflicting and unambiguous
spec_ref: ".agents/specifications/languages/expression-layer.spec.md#syntax-governance-requirements"
---

# Non-conflicting and Unambiguous Feature Syntax

## Requirement

Preconditions:

- Expression language feature subtopics are defined for terminals, grouping,
  structuring, invocation, unary/binary operators, and string/interpolation
  syntax.

Expected behavior:

- Feature syntax forms MUST be valid and non-conflicting.
- Fixed tokenizer output MUST map to a deterministic parse outcome without
  ambiguous tie-breaking.

Postconditions:

- Expression language syntax remains predictable for human authors and code
  generation tools.
