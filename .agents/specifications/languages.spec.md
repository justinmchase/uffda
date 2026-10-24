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

### Published JSR grammars

- The published JSR package MUST export reusable `.uff` modules (via
  `uffda.jsonc`) for tokenization, pattern and expression grammars, import and
  export declaration syntax, and the Uffda language (including its `Language`
  decorator), together with their compiled `bin/` artifacts.
- The published package MUST expose composable token-level `Pattern` and
  `Expression` rules separately from the source-normalizing, tokenizing,
  end-of-input language entry points (as `.uff` package exports).
- The published `.uff` package MUST expose the reusable source-normalization
  grammar module.
- Grammar package exports MUST remain generic parser infrastructure; they MUST
  NOT encode downstream application-language semantics.
- The JSR package MUST NOT publish Deno TypeScript runtime or grammar-API
  subpaths; see
  [JSR package contract](./languages/cli/distribution-and-release.spec.md#jsr-package-contract).

### Runtime implementation

- After the production cutover and successful full-circle bootstrap acceptance,
  the Rust runtime and CLI are the maintained implementation. The retired Deno
  runtime, CLI, and TypeScript grammar wrappers MUST NOT be required to build,
  test, or execute language modules.
- Authored `.uff` grammars and the checked-in compatibility fixtures MUST remain
  available. Rust tests MUST verify the fixtures independently, without invoking
  the retired reference implementation or regenerating expected outcomes.
- TypeScript MAY remain for the VS Code extension, JSR notice entry point,
  release/setup helpers, and Rust measurement tooling. It MUST NOT introduce a
  second runtime implementation.
