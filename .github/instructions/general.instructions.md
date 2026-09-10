---
description: "General repository conventions for Uffda. Use when writing code, specs, requirements, or contributor docs."
applyTo: "**"
---

# Repository instructions

Uffda is a Deno-based parser generator for domain specific languages.

**Compiler bootstrap:** see
`.github/instructions/compiler-bootstrap.instructions.md`. `compile:lang` =
previous published `uffda compile` only → ModuleDeclaration under `./bin`;
resolve loads JSON only. Never post-process `./bin` after compile; wrong AST
shape → publish → install → recompile.

## Runtime and dependency conventions

- Prefer Deno-native and Web Platform APIs over Node.js APIs.
- Default to ESM TypeScript.
- **Scripting language hard rule:** the only acceptable scripting languages in
  this repository are TypeScript and Deno. Python (and other non-Deno scripting
  languages) are completely hard-blocked, including in GitHub Actions, composite
  actions, install helpers, and one-liners. Shell may orchestrate
  Deno/`gh`/`curl` commands, but non-trivial logic MUST live in TypeScript run
  with Deno.
- Add third-party imports through the `imports` field in `deno.jsonc` before
  using them in source files.
- Prefer JSR packages first. Use npm packages only when there is a clear need.
- Keep the library focused on parser-generation and runtime concerns rather than
  app-specific frameworks.

## Project conventions

- Place implementation code under `src/`.
- Keep tests next to the modules they cover using the `.test.ts` suffix.
- Follow the existing Deno validation path: `deno fmt`, `deno lint`, and
  `deno task test`.
- **Before pushing** any commit that changes code (`.ts`, `.uff`, etc.) or
  Markdown (`.md`, `.mdc`), run `deno fmt` and include the formatting updates in
  the commit. CI runs `deno fmt --check` and will fail on unformatted files.
- Prefer `deno task pre` before committing.
- Keep modules small and composable when adding or refactoring parser logic.

## Type modeling conventions

- Prefer discriminated unions that use a `kind` field with an enum discriminator
  (for example `PatternKind`).
- When introducing union guards, follow the existing style used by `isPattern`:
  validate object shape and validate `kind` against the discriminator enum.
- Avoid introducing parallel discriminator properties for the same union (for
  example, do not add both `kind` and `type`/`mode` for the same purpose).
- Do not put variants in a discriminator enum unless they belong to that union.
- Keep discriminator enums narrow enough that callers do not need to mentally
  filter out irrelevant members.

## Specification authority and change control

Apply this strict authority order when implementing or evaluating behavior:

1. Spec documents (`.agents/specifications/**/*.md`)
2. Requirement documents (`.agents/requirements/**/*.requirement.md`)
3. Tests (`**/*.test.ts`)
4. Implementation code (`src/**`, `mod.ts`)

- Specs are intentionally higher level than requirements.
- Requirements refine and make specific behaviors from the spec testable.
- If a behavior change is not already covered in the relevant spec or
  requirement, update the documentation in the same PR as the implementation.
- Do not silently reinterpret tests or implementation to contradict the spec or
  requirements.
- If a requested behavior conflicts with existing spec or requirements, ask for
  clarification before changing lower-authority artifacts.

## Specification layout

- The spec is split across multiple smaller Markdown files under
  `.agents/specifications/`.
- `.agents/specifications/README.md` is the entry point and index for the spec
  set.
- Normative spec chapters use the `{topic}.spec.md` naming pattern.
- Requirement documents should reference the spec file and section they refine.

## Validation

After making changes—and **before pushing** when those changes include code or
Markdown—run:

```sh
deno fmt
deno lint
deno task test
```

Confirm `deno fmt --check` is clean before `git push`. CI runs
`deno fmt --check` and will fail on unformatted files.
