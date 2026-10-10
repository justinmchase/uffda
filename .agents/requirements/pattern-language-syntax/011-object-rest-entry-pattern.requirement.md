---
id: pattern-language-syntax-011
title: Object patterns parse ordered rest clauses
spec_ref: ".agents/specifications/languages/pattern-syntax/grammar.spec.md#object-patterns"
---

# Object Rest-Clause Syntax

## Requirement

Preconditions:

- A pattern declaration contains an object pattern.

Expected behavior:

- `{ id: number ...[string]: string }` MUST parse to an `over` pattern with
  named key `id` and one key/value rest clause.
- `...e:[k:string]: v:string` MUST parse to a rest clause with entry capture
  `e`, key capture `k`, and value capture `v`.
- Multiple `...[P]: V` clauses MUST parse in source order.
- `...ope` MUST parse as a catch-all rest clause and MUST be final.
- Rest clauses MAY appear without named entries and MAY have commas between
  clauses or a trailing comma.
- Entries declared after any rest clause MUST be rejected.

Postconditions:

- The normalized `over` pattern MUST preserve named keys, ordered rest clauses,
  optional entry capture names, and an optional final catch-all separately.
- Tests: `src/lang/pattern/structure.test.ts`.
