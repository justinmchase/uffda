---
id: pattern-language-syntax-010
title: Ope syntax normalizes to the recover runtime pattern
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#recovery"
---

# Ope Syntax

## Requirement

Preconditions:

- A pattern body contains `ope`.

Expected behavior:

- `ope P sneak by S` MUST normalize to
  `{ kind: "recover", pattern: P, skip: S }`, with `P` and `S` each parsed as a
  prefix operand.
- `ope P sneak by until T` MUST normalize to a recover pattern whose skip is
  `{ kind: "quantifier", pattern: { kind: "then", patterns: [{ kind: "not",
  pattern: T }, { kind: "any" }] }, min: 1 }`.
- `ope`, `sneak`, and `until` MUST be reserved keywords and MUST NOT parse as
  bare rule-reference identifiers; `@ope`, `@sneak`, and `@until` still
  reference rules with those names.

Postconditions:

- `by` is not reserved and remains a valid rule reference.

## Test plan

`src/requirements/pattern-language-syntax/010-ope-syntax.requirement.test.ts`
and `src/lang/pattern/prefix.test.ts`.
