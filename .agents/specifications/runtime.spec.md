# Runtime specification

This chapter indexes runtime-level contracts for execution, scope, and
evaluation semantics.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Runtime chapter structure

Each runtime subtopic should define:

- the runtime concern it governs;
- its required invariants;
- its interactions with pattern matching;
- its error and failure boundaries;
- its composition and extension intent;

## Subtopics

- [runtime scopes](./runtime/scopes.spec.md)
- [runtime left recursion](./runtime/left-recursion.spec.md)
