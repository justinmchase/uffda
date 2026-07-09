# Pattern bootstrap readiness checklist

Scope: close pattern-language gaps that block or slow self-hosting in the full
Uffda language-definition layer.

## Completed foundation

- [x] Symbol-only composition operators (`|` and `&`).
- [x] Optional leading `|` for vertically aligned alternatives.
- [x] Full-input consumption enforced at the pattern-language entrypoint.

## High-priority next

- [x] Identifier escaping for reserved resolve names.
  - Candidate syntax: `@identifier`.
  - Implemented: escaped identifiers parse in resolve names and resolve
    arguments.
- [x] Resolve arguments are full patterns.
  - Implemented: `Foo<"bar">` parses as an equal-pattern argument and nested
    forms like `Foo<Bar<"baz">>` are permitted.
- [x] Trailing separator support in separator-delimited forms.
  - Implemented: optional trailing comma or semicolon where separators are
    already used (`over`, `pipeline`, resolve arguments).
- [x] Non-semantic line breaks contract and tests.
  - Implemented: line breaks are accepted anywhere ordinary inter-token
    whitespace is accepted, including prefix forms, resolve arguments,
    alternatives, and object-like structures.

## Bootstrap ergonomics

- [x] Grouping affordance review.
  - Implemented: `(...)` remains the canonical grouping form.
  - Verified: grouping is sufficient for nested alternatives and pipeline child
    disambiguation; no additional grouping forms are needed before self-hosting.
- [x] Authoring examples for large grammars.
  - Implemented: canonical multiline examples now cover alternatives, pipelines,
    and object-like forms in the grammar spec and pattern-language reference.

## Diagnostics and visualization

- [x] Test-harness failure diagnostics for faster triage.
  - Implemented: shared test assertions now include structured match context and
    rightmost-failure span details in failure messages.
- Deferred: utility/CLI-style visualization work until the interactive parser UI
  app phase.

- [ ] Match result dump utility.
  - Deterministic text or JSON tree of match graph including failure path.
- [ ] Rightmost-failure and expectation summary.
  - Surface best failure location plus expected tokens or forms.
- [ ] Visualizer prototype.
  - Convert match tree into Mermaid-compatible output for rapid debugging.

## Uffda layer integration gates

- [ ] Uffda language-definition entrypoints enforce full-input consumption.
- [ ] Uffda declarations can round-trip authored syntax to canonical pattern and
      expression trees.
- [ ] Spec and requirement alignment for declaration syntax, imports, rule
      signatures, and expression projection.
