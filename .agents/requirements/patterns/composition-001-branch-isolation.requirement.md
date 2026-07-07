---
id: composition-001
title: Composition isolates failing exploratory branches from sibling branches and caller-visible scope
spec_ref: ".agents/specifications/patterns/composition.spec.md#input-consumption-and-backtracking-invariants; .agents/specifications/patterns/composition.spec.md#matching-context-and-scope-propagation"
---

# Composition Branch Isolation

## Requirement

Preconditions:

- A composed pattern evaluates one or more exploratory child branches from the
  same caller-visible input position.

Expected behavior:

- Input consumed by a branch that later fails MUST NOT become visible to sibling
  branches.
- Temporary bindings produced only by a branch that later fails MUST NOT become
  visible in sibling-branch evaluation or in the caller-visible result.
- A later sibling branch MUST evaluate as though the failed exploratory branch
  had not committed input or bindings.

Postconditions:

- Branch-local exploration remains isolated across composed matching paths.
