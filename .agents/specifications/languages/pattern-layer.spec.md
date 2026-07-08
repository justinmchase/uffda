# Pattern layer contracts

This chapter defines pattern-layer contracts for language authoring stacks.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The pattern layer provides the primary declarative matching mechanism used to
construct language grammars and layered compiler behavior.

## High-level principles

- Pattern matching is the conditional and binding mechanism for grammar authors.
- Guarding, branch selection, equality-like checks, and local variable capture
  SHOULD be modeled as patterns rather than by introducing expression-level
  control-flow syntax.
- Pattern evaluation MAY be exposed to expression/projection contexts through a
  native `match` function so patterns can be invoked like callable dynamic
  constraints.
- Pattern-based branching SHOULD remain separate from statement syntax such as
  `if`, `else`, `let`, `return`, and loops in the expression layer.

## Layer requirements

- Pattern-layer behavior MUST remain composable with token and expression
  outputs.
- Pattern evaluation MUST preserve deterministic matching semantics for fixed
  input and grammar configuration.
- Pattern outcomes MUST preserve or map source provenance for debugging.

## Integration requirements

- Pattern-layer contracts MUST support embedding in higher language-definition
  layers without introducing hidden context-sensitive bootstrap behavior.
- Pattern failure and error surfaces MUST remain distinguishable for diagnostics
  and language-tooling workflows.

## Composition intent

- Pattern-layer contracts SHOULD be reusable for non-Uffda top-level languages
  that still rely on Uffda matching/runtime semantics.
