# Patterns specification

This chapter defines the top-level contract for Uffda pattern declarations,
matching semantics, and composition rules.

## Composition as building blocks

Patterns are composable building blocks. Individual patterns can be combined
into larger structures that represent arbitrarily complex matching and
transformation behavior.

## Pattern matching

Uffda pattern matching is not limited to string content. Patterns can step into
any JavaScript runtime value, including objects and arrays, with strings being
only one supported matching surface.

## Direct left recursion

This section defines the top-level contract for direct left-recursive pattern
evaluation, detection, and stabilization behavior.

## Runtime pattern subtopics

### And pattern

Defines conjunction behavior where all child patterns must match.

### Any pattern

Defines wildcard behavior that can match any runtime value at the current
position.

### Character pattern

Defines character-level matching behavior for character-oriented inputs.

### End pattern

Defines end-of-input and completion boundary matching behavior.

### Equal pattern

Defines strict equality matching behavior against literal runtime values.

### Fail pattern

Defines explicit failure behavior used to force a non-match state.

### Includes pattern

Defines membership matching behavior for collections and container-like values.

### Into pattern

Defines traversal behavior that steps matching into nested runtime values.

### Maybe pattern

Defines optional matching behavior that permits success with or without a
matched value.

### Not pattern

Defines negation behavior where success is based on a child pattern not
matching.

### Ok pattern

Defines explicit success behavior used to return a matched value and scope.

### Or pattern

Defines disjunction behavior where any one child pattern can satisfy the match.

### Over pattern

Defines iteration behavior over runtime collections while applying a child
pattern.

### Pipeline pattern

Defines staged composition where pattern-matching steps chain together as a
single unified flow. This composition model can represent every compiler step in
one pattern pipeline.

### Range pattern

Defines interval and bounded matching behavior for ordered values.

### Reference pattern

Defines named-pattern indirection and reuse behavior through references.

### RegExp pattern

Defines regular-expression-backed matching behavior for regex-oriented use
cases.

### Run pattern

Defines executable pattern behavior that evaluates a callable matching step.

### Slice pattern

Defines segment extraction and sub-range matching behavior over inputs.

### Special pattern

Defines runtime-specific special-case matching behavior for reserved semantics.

### Then pattern

Defines sequential composition behavior where one pattern runs after another.

### Type pattern

Defines runtime type-guard matching behavior over JavaScript values.

### Variable pattern

Defines variable binding and capture behavior for matched runtime values.
