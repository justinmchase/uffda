---
id: expressions-runtime-009
title: Three-level syntax combinations evaluate to deterministic runtime values
spec_ref: ".agents/specifications/expressions/runtime-semantics.spec.md#three-level-combinatorial-integration-matrix; .agents/specifications/expressions/runtime-semantics.spec.md#composition-and-propagation"
---

# Three-level Syntax Combinatorics Integration Coverage

## Requirement

Preconditions:

- The expression language entry pipeline (`expr`) is available and evaluates
  syntactic inputs through normalization, tokenization, parsing, and runtime
  expression execution.
- String-literal leaf cases use the literal syntax `"text-value"`.
- Reference leaf cases use syntax `ref` bound to `{ from: "reference" }`.
- Spread syntax integration cases provide bindings for `xs`, `ys`, `base`,
  `override`, and `patch`.

Expected behavior:

- Implementations MUST evaluate every valid success case in the normative
  three-level combinatorial integration matrix.
- Each case MUST be expressed as syntax input and verified in two stages:
  - parse stage: actual parsed AST MUST equal expected expression AST;
  - execution stage: `exec(ast, match)` MUST equal expected runtime value.
- Case coverage MUST include all combinations where:
  - level 1 wrapper is one of `{array, object, string}`;
  - level 2 wrapper is one of `{array, object, string}`;
  - level 3 leaf is one of
    `{array, object, number, string-literal, reference, boolean, null, undefined}`.
- Core combinatorial success cases MUST be exactly $3 \times 3 \times 8 = 72$.
- Requirement coverage MUST also include explicit success cases for array spread
  and object spread syntax forms.
- Requirement coverage MUST include explicit function invocation cases for each
  leaf category in the matrix using deterministic callable bindings.
- Requirement coverage MUST include invocation argument spread success cases
  (for example `(coalesce x ...y)` and fixed-argument + spread combinations).

Postconditions:

- Integration-level behavior remains deterministic and executable from syntax to
  runtime value output across the full three-level success matrix.
