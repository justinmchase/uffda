---
id: uffda-language-syntax-008
title: Inline exported rules normalize to export and rule declarations
spec_ref: ".agents/specifications/languages/uffda-syntax/rule-declarations.spec.md#core-rule-contracts"
---

# Inline Exported Rule

## Requirement

Preconditions:

- A Uffda module contains `export rule Name = Pattern;` with an optional
  projection.

Expected behavior:

- Parsing MUST produce an export declaration for `Name` followed by its rule
  declaration.
- The output MUST equal the syntax tree produced by
  `export Name; rule Name = Pattern;`.

Postconditions:

- Runtime compilation receives the existing export and rule output models and
  requires no inline-export-specific declaration variant.
