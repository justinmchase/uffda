# Compiler and bootstrap progression layer

This chapter defines contracts for compiler progression and self-hosting
bootstrapping across language-layer versions.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The compiler/bootstrap layer governs how language stacks progress toward
self-hosting while maintaining deterministic and diagnosable behavior.

## Bootstrap progression requirements

- Bootstrap progression SHOULD allow the current stable compiler to compile the
  next language-layer version.
- Layer contracts MUST remain versionable so source and diagnostic provenance
  can be preserved across compiler upgrades.
- Bootstrap workflows MUST preserve deterministic outcomes for fixed input,
  compiler version, and module graph.

## Compatibility requirements

- Compiler/bootstrap contracts SHOULD define compatibility boundaries explicitly
  when evolving layer representations.
- Migration paths SHOULD preserve debuggability and source-context fidelity,
  especially for complex pattern and expression stacks.

## Composition intent

- Compiler/bootstrap contracts SHOULD support reuse by language stacks that
  share lower Uffda layers but define alternate top-level languages.
