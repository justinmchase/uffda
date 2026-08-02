# Uffda runtime compilation

This chapter defines the contract for compiling Uffda language-definition syntax
trees into executable runtime module declarations.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The Uffda runtime compiler lowers the structured output of `UffdaLang` into the
runtime `ModuleDeclaration` representation. This lowering establishes the Uffda
runtime as a reusable compilation target for Uffda-based language layers.

## Compiler language contract

- The Uffda runtime compiler MUST be representable as an executable Uffda
  language definition.
- The compiler entry rule MUST accept a structured Uffda syntax tree as input,
  not source text or a token stream.
- Compiler rules MUST select and decompose source AST structures through Uffda
  pattern matching.
- Declaration sequence transformation MUST be expressed through compiler rule
  composition rather than host-language declaration iteration and variant
  dispatch.
- Compiler projections MUST produce runtime declaration structures that satisfy
  the runtime module contract.

## Compilation boundary

- `UffdaLang` MUST produce a syntax-level module representation that remains
  distinct from the executable runtime module representation.
- Pattern and projection slots in the syntax tree MUST contain structured
  lower-layer outputs suitable for compilation and MUST NOT require source-token
  reparsing by the runtime compiler.
- Compilation MUST preserve stable module, rule, import, and export identities.
- Compilation MUST preserve declaration ordering where ordering is observable by
  module resolution or runtime execution.
- A successful compilation MUST produce a runtime `ModuleDeclaration` that can
  be consumed by the standard module resolver and execution path without
  bootstrap-only exceptions.

## Host integration boundary

- Host APIs MAY resolve the compiler language, provide its structured input,
  execute its entry rule, and expose the resulting match or module declaration.
- Host APIs MUST NOT duplicate the semantic AST-to-runtime transformation with
  imperative declaration traversal or discriminator dispatch.
- Parsing, compilation, and runtime execution MUST remain independently
  invocable boundaries so each stage can be tested and diagnosed separately.

## Diagnostics and provenance

- Compiler failures MUST identify the compiler rule and source AST path at which
  transformation failed.
- Compilation MUST preserve or map authored source provenance so downstream
  diagnostics can resolve through the syntax AST to original source context.
- Compiler outcomes MUST be deterministic for a fixed syntax tree, compiler
  version, and resolver configuration.

## Reusable target contract

- Uffda-based DSLs MAY target the runtime module representation through their
  own pattern-driven compiler languages.
- Compiler languages that target the Uffda runtime MUST produce structures
  governed by the same runtime module, pattern, and expression contracts as
  `UffdaRuntimeCompiler`.
- Alternate compiler targets MAY lower the same or higher-level syntax trees to
  external artifacts without changing the Uffda runtime compilation contract.

## Open questions

- The syntax contract for selecting a module's default exported rule remains to
  be specified before compiler requirements choose a concrete policy.

## Canonical target decision

- The canonical Morse language uses `=` to separate each rule identity from its
  pattern body, as required by the Uffda rule declaration contract.
