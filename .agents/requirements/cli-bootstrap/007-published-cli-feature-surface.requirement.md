---
id: cli-bootstrap-007
title: Authored .uff sources stay within the published CLI feature surface
spec_ref: ".agents/specifications/languages/compiler-bootstrap.spec.md#published-compiler-feature-surface; .agents/specifications/languages/compiler-bootstrap.spec.md#compile-pipeline-and-recursion-break; .agents/specifications/languages/uff-module-conversion-plan.md#bootstrap-compiler-constraint"
---

# Published CLI Feature Surface For Authored Uff

## Requirement

Preconditions:

- Bootstrap produces `./bin` via `deno task compile:lang`.
- In-tree sources may already contain unreleased language or std changes for
  version N+1.

Expected behavior:

- Authored `.uff` modules under `src/lang/` MUST stay within the published CLI
  (version N) **feature surface** (syntax / std / pattern forms already shipped)
  — see G0.
- `compile:lang` MUST invoke the previous published `uffda compile` for parse
  (quoted glob such as `'src/lang/**/*.uff'`), then the compile-pipeline lower
  stage (previous published `UffdaRuntimeCompiler`) to ModuleDeclarations.
- Compile MUST NOT leave syntax ASTs as final `./bin` artifacts and MUST NOT
  commit seeds under `src/`.
- A module MUST NOT be converted to `.uff` until every construct it needs is
  available in the published CLI feature surface (G0).
- Converted `.uff` modules MUST NOT keep host TypeScript twins or
  `*.bootstrap.ts` registry stubs. Runtime loads them only via `.uff` → `./bin`
  remapping after compile.

Postconditions:

- Self-hosting conversion cannot race ahead of published language-feature
  capability.
- New syntax/std must publish before dependent `.uff` conversion.
- The runtime-compiler chicken/egg is broken by previous-CLI parse +
  previous-compiler lower, not by recursive `./bin` import or `src/` seeds.
