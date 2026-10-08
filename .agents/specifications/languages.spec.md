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
- Compiler/meta layer for compiling and loading language modules.

## Subtopics

- [source normalization and source-context indexing](./languages/source-normalization.spec.md)
- [tokenization and token model boundaries](./languages/tokenization.spec.md)
- [comment syntax](./languages/comment-syntax.spec.md)
- [expression layer contracts](./languages/expression-layer.spec.md)
- [pattern layer contracts](./languages/pattern-layer.spec.md)
- [pattern idioms for map and reduce](./languages/pattern-idioms-map-reduce.spec.md)
- [uffda language-definition layer](./languages/uffda-language.spec.md)
- [compiler and bootstrap progression layer](./languages/compiler-bootstrap.spec.md)
- [debuggability and source-context fidelity](./languages/debuggability.spec.md)
- [command-line interface](./languages/cli.spec.md)
- [project file](./languages/project-file.spec.md)

## Composition intent

- Language-layer contracts SHOULD prioritize inspectability and deterministic
  diagnostics as grammar complexity increases.
- Language-layer interoperability SHOULD allow downstream users to reuse lower
  layers (for example tokenizer and expression foundations) with alternate
  language-definition layers.

## Public grammar APIs

- The published package MUST expose the generic grammar parser and the
  tokenizer, pattern, expression, and Uffda grammar entry points as supported
  TypeScript subpath exports.
- `parseGrammar` MUST allow callers to parse through a grammar module into a
  caller-selected AST type without requiring that grammar to be the Uffda
  language.
- Generic grammar parsing MUST allow callers to configure the resolver's
  artifact layout, import map, and package resolver while retaining the built-in
  language declarations and default globals.
- The published Uffda grammar package MUST export reusable `.uff` modules for
  tokenization, pattern and expression grammars, import and export declaration
  syntax, and the Uffda language (including its `Language` decorator).
- Public grammar APIs MUST remain generic parser and AST-lowering
  infrastructure; they MUST NOT encode downstream application-language
  semantics.
