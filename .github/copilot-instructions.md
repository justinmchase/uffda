# GitHub Copilot Instructions for Uffda

Uffda's runtime and CLI are Rust. The Deno reference implementation is retired.
Follow [AGENTS.md](../AGENTS.md) for repository conventions, specification
authority, bootstrap restrictions, and release rules.

## Layout and tests

- Runtime and CLI: `src/`; Rust unit tests live with their modules and
  process/standalone tests under `tests/`.
- Languages: authored `.uff` under `src/lang/`, compiled to `bin/` by the
  previous published CLI. Never restore TypeScript language twins or mutate
  artifacts after compilation.
- Preserve `tests/rust/*.json` compatibility fixtures as independent regression
  inputs; tests must not regenerate expected outcomes.
- TypeScript helpers use Node.js; the VS Code extension remains an independent
  npm package, and `mod.ts` remains the JSR notice. Helper tests use `.test.ts`.
- Every implementation change needs corresponding tests citing `req:{id}`.

## Validation

Bootstrap using the previous published `uffda`, then run:

```sh
npm ci
npm run compile:lang
npm run format:check
npm run lint
npm run check:types
npm run test:tools
cargo xtask check
```

Run `npm run fmt:uff` for `.uff` edits. `npm run pre` combines formatting,
grammar formatting, Rust checks, helper tests, and JSR package validation. Do
not cancel builds or tests.

## Scripting

Use ESM TypeScript with Node built-ins/Web APIs for helper scripts; no Python or
other scripting languages. Add repository tooling dependencies to
`package.json` and commit the npm lockfile. Runtime implementation dependencies
belong in the Rust workspace manifests.
