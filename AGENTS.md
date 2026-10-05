# Uffda agent instructions

Uffda is a Deno-based parser generator for domain specific languages.

These instructions apply to all agent tooling (Cursor, Copilot, and others).
Path-scoped authoring guidance also lives in:

- `.cursor/rules/` (Cursor)
- `.github/instructions/` (GitHub Copilot)

**Compiler bootstrap / recursion break** (always apply): see
`.cursor/rules/compiler-bootstrap.mdc`,
`.github/instructions/compiler-bootstrap.instructions.md`, and
`.agents/specifications/languages/compiler-bootstrap.spec.md`. `compile:lang` =
previous published `uffda compile` only → ModuleDeclaration JSON under `./bin`.
Resolve only loads that JSON. Never re-lower on import, seed compiler JSON under
`src/`, or post-process / migrate / rewrite `./bin` after compile. Wrong AST
shape → publish emitter → install → `compile:lang` again.

**Authoring `.uff` grammars:** see `.cursor/rules/uffda-authoring.mdc` and
`.github/instructions/uffda-authoring.instructions.md`. Give each required
element a small documented rule that begins where it may be missing, test every
explained mistake in the corpus, and prefer correct, then maintainable, then
performant grammar.

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

- Entry point: `mod.ts`
- Place implementation code under `src/`.
- Keep tests next to the modules they cover using the `.test.ts` suffix.
- Put scratch scripts and other throwaway files under `.tmp/` (gitignored),
  never in the repository root or `src/`.
- For every source file you create or modify under `src/`, create or update the
  corresponding `*.test.ts` file in the same directory.
- Follow the existing Deno validation path: `deno fmt`, `deno lint`, and
  `deno task test`.
- **Before pushing** any commit that changes code (`.ts`, `.uff`, etc.) or
  Markdown (`.md`, `.mdc`), run `deno fmt` and include the formatting updates in
  the commit. CI runs `deno fmt --check` and will fail on unformatted files.
- A commit that changes `.uff` files MUST also run `deno task fmt:uff` (the
  in-tree `uffda fmt`) and include its changes. CI runs `uffda fmt --check`.
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

## Specifications

This repository follows the specs method, as declared in `.agents/SPECS`
(<https://github.com/justinmchase/specs>).

- Authority, highest first: specifications (`.agents/specifications/`),
  requirements (`.agents/requirements/`), tests, implementation. Never change a
  lower layer to contradict a higher one; if a request conflicts with the
  specification or a requirement, ask before proceeding.
- A behavior change updates the specification or requirement that covers it in
  the same change as the code.
- Tests cite the requirements they verify with `req:{id}`.
- Before writing specifications or requirements, use the `specs` and
  `requirements` skills. Without the plugin installed, read them at
  <https://raw.githubusercontent.com/justinmchase/specs/v1/skills/specs/SKILL.md>
  and
  <https://raw.githubusercontent.com/justinmchase/specs/v1/skills/requirements/SKILL.md>.

## Releases

- Never create, push, or move git tags manually. Tags are created by the release
  process (Release Drafter + Release Binaries) and GitHub release tags are
  immutable, so a stray tag permanently burns that version.
- Never mark a release as a pre-release unless its version carries a `-pre.N`
  suffix (for example `0.3.0-pre.1`). Demoting a normal version such as `0.2.7`
  to a pre-release is not allowed.
- To change the next version, use Release Drafter's `major` / `minor` / `patch`
  PR labels rather than editing tags or version files by hand.

## Validation

After making changes—and **before pushing** when those changes include code or
Markdown—run:

```sh
deno fmt
deno task fmt:uff
deno lint
deno task test
```

Do not cancel these commands; they normally finish quickly. Confirm
`deno fmt --check` is clean before `git push`.
