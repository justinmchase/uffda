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
- Invocation forms MUST normalize deterministically to canonical call expression
  nodes.

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
