---
id: quantifier-001
title: Quantifier repeats child pattern within declared bounds with progress guarantees
spec_ref: ".agents/specifications/patterns/runtime/quantifier.spec.md"
---

# Quantifier Core Semantics

## Requirement

Preconditions:

- Quantifier pattern declares repetition bounds for child pattern.

Expected behavior:

- Quantifier MUST repeat successful child matches until bounds/termination
  criteria are reached.
- Quantifier MUST preserve original position when minimum bound is not
  satisfied.
- Quantifier MUST terminate non-progressing repetition attempts.
- Quantifier MUST stop without evaluating its child at the end of a closed
  input, and MUST evaluate its child once more at the end of an open input,
  recording that attempt among its matches without changing its value when the
  attempt fails.

Postconditions:

- Quantifier output MUST contain accumulated successful child outputs.
