# Languages specification

This chapter defines the top-level contract for language definitions authored
with Uffda and how language metadata and grammar contracts are represented.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Language layering intent

- Language layers SHOULD be reusable and composable across multiple language
  stacks, not only the default Uffda bootstrap language set.
- The default bootstrap stack SHOULD avoid context-aware whitespace semantics
  beyond requiring at least one whitespace separator where grammar requires it.
- Newline-sensitive and indentation-sensitive parsing MUST NOT be required by
  default bootstrap layers.

## Default bootstrap stack

- Source normalization and source-context indexing.
- Tokenization (including lexeme/scanning behavior).
- Expression language.
- Pattern language.
- Uffda language definition layer.
- Compiler/meta layer for self-hosting progression.

## Subtopics

- [source normalization and source-context indexing](./languages/source-normalization.spec.md)
- [tokenization and token model boundaries](./languages/tokenization.spec.md)
- [expression layer contracts](./languages/expression-layer.spec.md)
- [pattern layer contracts](./languages/pattern-layer.spec.md)
- [uffda language-definition layer](./languages/uffda-language.spec.md)
- [compiler and bootstrap progression layer](./languages/compiler-bootstrap.spec.md)
- [debuggability and source-context fidelity](./languages/debuggability.spec.md)

## Composition intent

- Language-layer contracts SHOULD prioritize inspectability and deterministic
  diagnostics as grammar complexity increases.
- Language-layer interoperability SHOULD allow downstream users to reuse lower
  layers (for example tokenizer and expression foundations) with alternate
  language-definition layers.
