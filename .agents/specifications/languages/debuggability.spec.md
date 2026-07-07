# Debuggability and source-context fidelity

This chapter defines debug-oriented language-layer contracts for source context,
provenance, and deterministic diagnostics across language transformations.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

As language definitions and pattern projections grow more complex, debuggability
requirements ensure failures can be diagnosed from runtime outcomes back to
precise authored source locations.

## Source-context preservation requirements

- Every language layer MUST preserve source context sufficiently to report exact
  failure location and origin through layered transformations.
- Tokenization MUST preserve stable source spans for token outputs.
- Intermediate language artifacts SHOULD retain source-provenance metadata where
  layer transitions could otherwise lose diagnostic fidelity.

## Provenance mapping requirements

- Higher layers MUST retain or map source provenance so diagnostics can resolve
  from compiled/runtime failures back to authored source locations.
- Provenance mapping MUST remain stable for deterministic inputs and resolver
  configuration.
- Provenance loss at any layer boundary MUST be treated as a contract regression
  unless explicitly specified by a higher-authority chapter.

## Diagnostic determinism requirements

- Debug traces SHOULD remain deterministic for fixed input and fixed language
  configuration.
- Equivalent source inputs SHOULD produce equivalent location and provenance
  diagnostics across repeated runs.
- Layer-level error reports SHOULD include enough structural context to
  distinguish tokenization, expression, pattern, and language-definition
  failures.

## Composition intent

- Debug contracts SHOULD remain reusable for alternate language stacks built on
  lower Uffda layers.
- Debug instrumentation SHOULD compose with bootstrap progression without
  introducing whitespace-sensitivity or context-sensitive parsing dependencies.
