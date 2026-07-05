# Runtime scopes

This chapter defines the runtime scope model used by pattern matching, rule
evaluation, and expression execution.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

A runtime scope represents the active matching context. It provides the current
input position, visible rule bindings, variable bindings, and runtime options
required to evaluate patterns deterministically.

## Scope model

- A runtime scope MUST include an active input stream position.
- A runtime scope MUST include rule visibility for local rules, imported rules,
  and bound rule arguments.
- A runtime scope MUST include variable bindings produced by successful pattern
  evaluations.
- A runtime scope MUST include runtime memoization state used for recursion and
  repeat evaluation.
- A runtime scope MUST include stack-frame context for module, rule, and
  pipeline execution boundaries.
- A runtime scope MUST include runtime options and special values needed for
  runtime behavior.

## Scope transitions during pattern matching

- Pattern evaluation MUST treat scope as immutable input and produce a resulting
  scope for match outcomes.
- Successful patterns MAY advance the input stream in the resulting scope.
- Failed patterns MUST preserve the caller-visible input position unless the
  caller composes behavior that commits consumption explicitly.
- Patterns that add variable bindings MUST merge those bindings into the
  resulting scope according to pattern semantics.
- Patterns that evaluate child or nested patterns MAY construct derived scopes,
  but resulting behavior MUST be projected back to caller-visible scope
  boundaries.

## Rule-resolution semantics

- Rule lookup in scope MUST resolve bound rule arguments before local module
  rules.
- If no bound argument or local module rule matches, lookup MUST resolve
  imported module rules.
- If no visible rule matches, rule lookup MUST fail.
- Runtime scope for rule evaluation MUST enforce module boundaries such that
  rule visibility is determined by the active module and explicit argument
  bindings.

## Pattern-matching interactions

- Reference-based pattern matching MUST use scope rule-resolution semantics for
  target and argument resolution.
- Input-consuming patterns MUST report resulting input positions through scope.
- Zero-width patterns MUST preserve input position in scope.
- Left-recursion handling MUST use scope memoization and stack context to
  prevent non-progressing infinite recursion.

## Error conditions

- Runtime operations that require missing scope bindings MUST report an
  appropriate runtime error.
- Scope violations across module boundaries MUST report an error or fail
  according to the governing pattern or rule contract.

## Side effects

- Scope transitions MUST NOT produce externally observable side effects beyond
  match results, resulting scope state, and defined runtime diagnostics.

## Composition intent

- Scope semantics SHOULD enable composable pattern evaluation where nested and
  delegated matches remain predictable.
- Scope semantics MAY be extended for additional runtime concerns as long as
  existing rule-resolution and input-position invariants are preserved.
