---
id: cli-bootstrap-007
title: Authored .uff sources stay within the published CLI feature surface
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#published-compiler-feature-surface; .agents/specifications/languages/compiler-bootstrap.spec.md#compile-pipeline-and-recursion-break"
---

# Published CLI Feature Surface For Authored Uff

## Requirement

Preconditions:

- Bootstrap produces `./bin` via `deno task compile:lang`.
- In-tree sources may already contain unreleased language or std changes for
  version N+1.

Expected behavior:

- Authored `.uff` modules under `src/lang/` MUST stay within the published CLI
  (version N) **feature surface** (syntax / std / pattern forms already
  shipped).
- `compile:lang` MUST invoke the previous published `uffda compile` directly for
  the full parse + lower pipeline in one step (quoted glob such as
  `'src/lang/**/*.uff'`), producing ModuleDeclaration JSON without any in-tree
  TypeScript lower stage or frozen compiler snapshot.
- Compile MUST NOT leave syntax ASTs as final `./bin` artifacts and MUST NOT
  commit seeds under `src/`.
- New language or std features MUST ship in a published CLI before in-tree
  `.uff` modules depend on them for compile-time acceptance.
- Language ModuleDeclarations MUST load via `.uff` → `./bin` remapping after
  compile. Host TypeScript twins or `*.bootstrap.ts` registry stubs MUST NOT
  remain as alternate declaration sources.

Postconditions:

- Authored language sources cannot race ahead of published language-feature
  capability.
- New syntax/std must publish before dependent `.uff` modules use them.
- The runtime-compiler chicken/egg is broken by a single previous-published-CLI
  step (parse + lower in one process), not by recursive `./bin` import or `src/`
  seeds.
