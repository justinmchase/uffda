# Contributing to Uffda

Thanks for your interest in contributing.

## Ground rules

- Keep changes focused — one concern per PR.
- Run `npm ci`, `npm run format:check`, `npm run lint`,
  `npm run check:types`, `npm run test:tools`, and `cargo xtask check` before
  submitting. Bootstrap language artifacts first.
- **Every implementation change MUST align with the spec.** If parser behavior,
  matching behavior, runtime behavior, or externally visible semantics change,
  and that change is not already documented in `.agents/specifications/` or
  `.agents/requirements/`, include the corresponding documentation updates in
  the same PR.
- Specs are higher level than requirements. Requirements should refine spec
  chapters rather than replace them.

## Spec alignment checklist (required in PR description)

- [ ] I confirmed this change is consistent with
      `.agents/specifications/README.md` and the impacted
      `.agents/specifications/**/*.spec.md` files.
- [ ] If behavior was not already covered, I updated the relevant spec and/or
      requirement documents.
- [ ] I listed the impacted spec and requirement files in the PR description.

## Development

```sh
npm ci
npm run compile:lang # previous published uffda → ./bin
npm run format:check
npm run lint
npm run check:types
npm run test:tools
cargo xtask check
```

For `.uff` changes, also run `npm run fmt:uff`. `npm run pre` combines
formatting, grammar formatting, helper lint/type checks/tests, Rust checks, and
a JSR package dry-run. `npm test` bootstraps and runs Rust workspace tests plus
the Node helper tests.

## Repository layout

```text
.agents/specifications/   High-level specification documents
.agents/requirements/     Requirement documents derived from the spec
src/lang/                 Authored .uff language definitions
src/                       Production Rust runtime, CLI, and crates
tests/                     Rust integration tests
test/rust/                Preserved compatibility fixtures
scripts/                  Node.js release and measurement helpers
editors/vscode/           Independently built TypeScript extension
mod.ts                    JSR notice entry point (no runtime APIs)
```

## Rust migration

See the [migration record](./docs/rust-migration.md) and
[Rust development instructions](./docs/rust-development.md). The Rust CLI is
production; the Deno reference implementation is retired. Preserve `.uff`
grammars and JSON compatibility fixtures, and cite requirements with `req:{id}`
in Rust tests.
Checks validates full-circle compilation using the published CLI followed by a
Rust CLI built from its artifacts, then runs Rust and standalone acceptance.
