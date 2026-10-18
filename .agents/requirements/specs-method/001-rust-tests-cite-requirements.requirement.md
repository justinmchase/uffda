---
id: specs-method-001
title: Rust unit tests cite existing requirement ids
spec_ref: ".agents/specifications/specs-method.spec.md#test-citations"
---

# Rust tests cite requirements

## Requirement

Preconditions:

- Requirement documents under `.agents/requirements/` declare unique `id`
  values.
- The Rust library crate contains `#[test]` functions.

Expected behavior:

- Every `#[test]` function MUST be preceded by at least one `req:{id}` citation
  between the attribute and the `fn` name.
- Every cited id MUST match an existing requirement document's `id` field.

Postconditions:

- Tests: `rust/src/traceability_tests.rs`
  (`rust_inline_tests_cite_existing_requirement_documents`).
