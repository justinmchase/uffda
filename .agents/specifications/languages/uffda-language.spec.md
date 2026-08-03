# Uffda language-definition layer

This chapter defines contracts for the Uffda language-definition layer that
describes modules, rules, and language metadata on top of shared lower layers.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The Uffda language-definition layer composes tokenizer, expression, and pattern
layers into author-facing language/module declarations.

## Layer requirements

- Uffda language definitions MUST be representable through lower-layer outputs
  without requiring bootstrap-only parsing exceptions.
- Language-definition contracts MUST preserve stable module/rule identity across
  compilation and runtime resolution.
- Language-definition diagnostics MUST map back to authored source context.

## Integration requirements

- Uffda language definitions MUST interoperate with module-resolution and
  runtime execution contracts.
- Language-definition outputs SHOULD be consumable by compiler/meta layers for
  self-hosting progression.

## Syntax sub-specs

- [Uffda syntax contracts](./uffda-syntax.spec.md)

## Compilation sub-specs

- [Uffda runtime compilation](./uffda-runtime-compilation.spec.md)

## Composition intent

- Uffda language-definition contracts SHOULD remain explicit enough that
  alternative top-level language definitions can interoperate with shared lower
  layers.

## Delivery milestones

### Milestone 1: Specify runtime compilation

- Define the Uffda syntax AST to runtime `ModuleDeclaration` boundary.
- Require compilation to be expressed as an executable Uffda language whose
  rules transform structured AST input through pattern matching.
- Define target reuse, diagnostic provenance, and host-integration boundaries.
- Derive focused requirement documents from the compilation contracts.

### Milestone 2: Establish the compiler language

- Add an `UffdaRuntimeCompiler` module declaration with a structured AST entry
  rule.
- Compile a manually constructed `UffdaSyntaxModule` into an exact runtime
  `ModuleDeclaration` fixture.
- Cover unsupported AST variants and malformed compiler input.

### Milestone 3: Compile declaration families

- Transform import, export, and rule declarations through dedicated compiler
  rules.
- Transform declaration sequences through pattern composition rather than host
  language iteration and variant dispatch.
- Preserve declaration identity, ordering, and source provenance.

### Milestone 4: Replace imperative compilation

- Route `compileUffdaSyntaxModule` through `UffdaRuntimeCompiler`.
- Keep host functions limited to resolving and executing the compiler language
  and unwrapping its match result.
- Remove token reparsing and imperative declaration transformation from the host
  compilation path.

### Milestone 5: Validate the complete pipeline

- Validate source parsing, AST compilation, module resolution, and runtime
  execution as separate boundaries and as one end-to-end path.
- Add requirement coverage for deterministic compiler failures and source-path
  diagnostics.

### Milestone 6: Add a canonical Morse language

- Define a non-trivial `MorseLang` fixture that compiles and translates Morse
  input into text.
- Use the canonical `=` rule binding form.
- Use the fixture to demonstrate that compiling to the Uffda runtime is a
  reusable target for Uffda-based DSLs.

### Milestone 7: Visualize match failures

- Add a deterministic, cycle-safe text visualization for runtime match failures.
- Identify unexpected input, pattern expectations, named rule hierarchy, and
  module provenance.
- Show successful pipeline outputs and the failed pipeline step for malformed
  expression-language source.

### Milestone 8: Deliver the Uffda CLI and interactive workbench

- Define and deliver a deterministic CLI surface for file/folder compilation,
  stream operation, and language-selection flags.
- Emit JSON-serializable AST artifacts and runtime-oriented envelopes.
- Deliver an interactive editor-like workbench with dynamic visualization and
  file I/O orchestration.
- Package the CLI as a `deno compile` product and publish release binaries via
  GitHub Releases.
- Define compatibility, diagnostics, and release gates for operator-facing CLI
  stability.
