# Function invocation syntax

This chapter defines function invocation expression forms.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Syntax requirements

- Function invocation MUST use explicit grouping delimiters `(` and `)`.
- Invocation forms MUST remain low-sugar and explicit for deterministic code
  generation.
- Invocation argument structure MUST be unambiguous for fixed tokenizer output.
- Invocation syntax MUST support zero or more arguments.
- Invocation target evaluation MUST resolve to a callable value.
- Non-callable invocation targets MUST report deterministic invocation errors;
  scalar values MUST NOT be implicitly coerced into identity-call behavior.
- Invocation forms MUST normalize deterministically to canonical call expression
  nodes.
- When the host grammar keeps comments (see
  [pattern comments](../pattern-syntax/grammar.spec.md#comments)), comment nodes
  MAY appear before, between, or after the arguments. They MUST be kept in the
  `args` list in source order. A comment before the invocation target MUST be a
  syntax error.

## Valid syntax examples

- `(f)`
- `(f x)`
- `(f x y)`
- `((getFactory) x)`

## Invalid syntax examples

- `f(x)` (unsupported high-sugar call form)
- `(f, x)` (unsupported comma-delimited argument form)
- `(f` (missing closing `)`)
- `f x)` (missing opening `(`)
