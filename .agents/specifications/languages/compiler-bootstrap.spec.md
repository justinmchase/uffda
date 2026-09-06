# Compiler and bootstrap progression layer

This chapter defines contracts for compiler progression and self-hosting
bootstrapping across language-layer versions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The compiler/bootstrap layer governs how language stacks progress toward
self-hosting while maintaining deterministic and diagnosable behavior.

## Bootstrap definition

- Bootstrapping MUST mean: using the latest published Uffda CLI to compile the
  next version of Uffda.
- The published CLI product MUST consist of the runtime, the language layers,
  and the CLI compiler wrapper that imports those languages.
- After self-hosting lands, language definitions consumed by a released CLI
  binary MUST come from compiled artifacts rather than TypeScript module sources
  that define those languages.

## Artifact layout requirements

- Authored language and CLI sources for self-hosting MUST be expressible as
  `.uff` modules.
- Compiling those sources with the Uffda CLI MUST emit JSON artifacts under
  `./bin/`.
- The next CLI binary MUST load language definitions from those `./bin/` JSON
  artifacts for the compiled product.
- Artifact paths and names under `./bin/` MUST be deterministic for a fixed
  source tree and compiler version.

## Full-circle validation requirements

- Bootstrap workflows MUST include a full-circle test: compile Uffda sources
  with CLI version N, then use the resulting artifacts (or a CLI built from
  them) to compile the same sources again.
- The second compile MUST succeed for the fixed source tree and configuration
  used in the first compile.
- Bootstrap workflows SHOULD include additional regression tests over compiled
  outputs before those outputs are packaged into a CLI binary.
- Bootstrap workflows MUST preserve deterministic outcomes for fixed input,
  compiler version, and module graph.

## Bootstrap progression requirements

- Bootstrap progression MUST allow the current stable published CLI to compile
  the next language-layer and CLI version.
- Layer contracts MUST remain versionable so source and diagnostic provenance
  can be preserved across compiler upgrades from version N to N+1.

## Compatibility requirements

- Compiler/bootstrap contracts SHOULD define compatibility boundaries explicitly
  when evolving layer representations.
- Migration paths SHOULD preserve debuggability and source-context fidelity,
  especially for complex pattern and expression stacks.

## Composition intent

- Compiler/bootstrap contracts SHOULD support reuse by language stacks that
  share lower Uffda layers but define alternate top-level languages.
- Distribution of CLI binaries used for bootstrapping is defined in the
  [distribution and release](./cli/distribution-and-release.spec.md) chapter.
