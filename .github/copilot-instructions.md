# GitHub Copilot Instructions for Uffda

Uffda's runtime and CLI are Rust. The Deno reference implementation is retired.
Follow [AGENTS.md](../AGENTS.md) for repository conventions, specification
authority, bootstrap restrictions, and release rules.

## Layout and tests

- Runtime and CLI: `rust/src/`; Rust unit tests live with their modules and
  process/standalone tests under `rust/tests/`.
- Languages: authored `.uff` under `src/lang/`, compiled to `bin/` by the
  previous published CLI. Never restore TypeScript language twins or mutate
  artifacts after compilation.
- Preserve `test/rust/*.json` compatibility fixtures as independent regression
  inputs; tests must not regenerate expected outcomes.
- TypeScript remains for `editors/vscode/`, the JSR notice `mod.ts`, and Deno
  release/setup/measurement helpers. Helper tests use `.test.ts`.
- Every implementation change needs corresponding tests citing `req:{id}`.

## Validation

Bootstrap using the previous published `uffda`, then run:

```sh
deno task compile:lang
deno fmt
deno lint
deno task test:tools
cargo xtask check
```

Run `deno task fmt:uff` for `.uff` edits. `deno task pre` combines formatting,
grammar formatting, Rust checks, helper tests, and JSR packaging validation. Do
not cancel builds or tests.

## Scripting

Use ESM TypeScript with Deno-native/Web APIs for helper scripts; no Python or
other scripting languages. Add helper imports to `deno.jsonc` before use and
include `deno.lock` updates. Runtime implementation dependencies belong in the
Rust workspace manifests.
