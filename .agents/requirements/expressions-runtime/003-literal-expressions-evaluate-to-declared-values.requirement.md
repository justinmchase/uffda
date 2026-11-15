---
id: expressions-runtime-003
title: Literal expressions evaluate to their declared values without consulting runtime scope
spec_ref: ".agents/specifications/expressions/number.spec.md#behavioral-expectations; .agents/specifications/expressions/boolean.spec.md#behavioral-expectations; .agents/specifications/expressions/symbol.spec.md#behavioral-expectations; .agents/specifications/expressions/value.spec.md#behavioral-expectations"
---

# Literal Expression Evaluation

## Requirement

Preconditions:

- The runtime evaluates a number, boolean, symbol, or serializable value
  expression.

Expected behavior:

- The runtime MUST return the expression's declared value.
- A symbol expression `@Identifier` MUST evaluate to the global registry symbol
  named `Identifier`, the same value as `symbol("Identifier")` and the
  data-codec symbols `@symbol"Identifier"` and `s"Identifier"`.
- The runtime MUST NOT depend on runtime scope values for evaluation. `@Name`
  MUST NOT resolve a binding named `Name`.
- The runtime MUST NOT introduce additional evaluation errors for these literal
  expression kinds.
- A host-provided owned codec literal MUST evaluate without a JSON conversion
  bridge, preserving native kinds and lossless strings.
- Reusing its compiled expression MUST construct fresh arena reference values;
  the compiled expression MUST NOT retain references to a previous arena.

Postconditions:

- Literal expression evaluation is deterministic for a fixed expression tree.
- Tests: `src/evaluate/tests.rs`.
