# Contributing to Uffda

Thanks for your interest in contributing.

## Ground rules

- Keep changes focused — one concern per PR.
- Follow `deno fmt`, `deno lint`, `deno task test:tools`, and
  `cargo xtask check` before submitting. Bootstrap language artifacts first.
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
deno task compile:lang # previous published uffda → ./bin
deno fmt
deno lint
deno task test:tools
cargo xtask check
```

For `.uff` changes, also run `deno task fmt:uff`. `deno task pre` combines
formatting, grammar formatting, helper lint/tests, Rust checks, and a JSR
packaging dry-run. `deno task test` bootstraps and runs Rust workspace tests
plus the Deno helper tests.

## Repository layout

```text
.agents/specifications/   High-level specification documents
.agents/requirements/     Requirement documents derived from the spec
src/lang/                 Authored .uff language definitions
rust/                     Production Rust runtime, CLI, and tests
test/rust/                Preserved compatibility fixtures
scripts/                  Deno release and measurement helpers
editors/vscode/           Independently built TypeScript extension
mod.ts                    JSR notice entry point (no runtime APIs)
```

## Rust migration

See the [migration record](./docs/rust-migration.md) and
[Rust development instructions](./rust/README.md). The Rust CLI is production;
the Deno reference implementation is retired. Preserve `.uff` grammars and JSON
compatibility fixtures, and cite requirements with `req:{id}` in Rust tests.
Checks validates full-circle compilation using the published CLI followed by a
Rust CLI built from its artifacts, then runs Rust and standalone acceptance.
