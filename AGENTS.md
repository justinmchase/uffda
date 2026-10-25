# Uffda agent instructions

Uffda is a parser generator for domain specific languages. Production CLI and
runtime are Rust; the Deno reference runtime and CLI are retired.

These instructions apply to all agent tooling (Cursor, Copilot, and others).
Path-scoped authoring guidance also lives in:

- `.cursor/rules/` (Cursor)
- `.github/instructions/` (GitHub Copilot)

**Compiler bootstrap / recursion break** (always apply): see
`.cursor/rules/compiler-bootstrap.mdc`,
`.github/instructions/compiler-bootstrap.instructions.md`, and
`.agents/specifications/languages/compiler-bootstrap.spec.md`. `compile:lang` =
previous published `uffda compile` only → ModuleDeclaration artifacts under `./bin`.
Resolve only loads those artifacts. Never re-lower on import, seed compiler JSON under
`src/`, or post-process / migrate / rewrite `./bin` after compile. Wrong AST
shape → publish emitter → install → `compile:lang` again.

**Authoring `.uff` grammars:** see `.cursor/rules/uffda-authoring.mdc` and
`.github/instructions/uffda-authoring.instructions.md`. Give each required
element a small documented rule that begins where it may be missing, test every
explained mistake in the corpus, and prefer correct, then maintainable, then
performant grammar.

## Runtime and dependency conventions

- Runtime and CLI code belongs in the Rust workspace. Keep `.uff` language
  definitions under `src/lang/`.
- Remaining helper scripts use ESM TypeScript executed by Node.js. Prefer Node
  built-ins and Web Platform APIs.
- **Scripting language hard rule:** TypeScript on Node.js is the only
  acceptable scripting language. Python and other scripting languages remain
  prohibited, including in GitHub Actions. Shell may orchestrate Node, Cargo,
  `gh`, and `curl`; non-trivial scripting logic belongs in TypeScript.
- Add repository tooling dependencies through the root `package.json` and
  commit `package-lock.json`. The VS Code extension keeps its separate package
  boundary.
- Retain `deno.jsonc`, `deno.lock`, and `mod.ts` only for the JSR package.
- Keep the library focused on parser-generation and runtime concerns rather than
  app-specific frameworks.

## Project conventions

- Rust entry points: `src/lib.rs` and `src/main.rs`. `mod.ts` is only
  the published JSR notice; it has no runtime APIs.
- Keep Rust unit tests with their modules and integration tests under `tests/`.
  Node helper tests use the `.test.ts` suffix.
- Put scratch scripts and other throwaway files under `.tmp/` (gitignored),
  never in the repository root or `src/`.
- Every implementation change needs a corresponding test. Preserve the JSON
  compatibility fixtures under `tests/rust/`; do not regenerate them from the
  current implementation to make tests pass.
- Validate with `npm run format:check`, `npm run lint`,
  `npm run check:types`, `npm run test:tools`, and `cargo xtask check` after a
  published-CLI bootstrap.
- **Before pushing** any commit that changes code (`.ts`, `.uff`, etc.) or
  Markdown (`.md`, `.mdc`), run `npm run format` and include the formatting updates in
  the commit. Checks runs Rust `cargo fmt`, Clippy, and `cargo test`.
- A commit that changes `.uff` files MUST also run `npm run fmt:uff` (the
  in-tree `uffda fmt`) and include its changes.
- Prefer `npm run pre` before committing. For Rust changes, run
  `cargo xtask check` (or `cargo xtask fix`) before pushing — same Format /
  Clippy / Test steps as the Checks workflow.
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
npm ci
npm run format:check
npm run fmt:uff
npm run lint
npm run check:types
npm run test:tools
cargo xtask check
```

Do not cancel these commands; they normally finish quickly. Checks gates Rust
`cargo fmt`, Clippy, and `cargo test`.
