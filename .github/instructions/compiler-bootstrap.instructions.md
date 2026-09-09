---
description: "Compiler bootstrap, previous-CLI chicken/egg break, and bin artifact rules. Use when compiling .uff, touching ./bin, runtime.compiler, resolvers, or CLI compile."
applyTo: "**"
---

# Compiler bootstrap and recursion break

Normative detail: `.agents/specifications/languages/compiler-bootstrap.spec.md`.

## Chicken / egg (do not “fix” with hacks)

Compiling `runtime.compiler.uff` (and other language `.uff`) into `./bin` must
**not** load that same module from workspace `./bin` via `Resolver.import` /
`runUffdaRuntimeCompiler`. That path is recursive.

**Break the cycle:**

1. **Bootstrap compile** (`deno task compile:lang`) shells out to the **previous
   published `uffda` CLI**
   (`uffda compile 'src/lang/**/*.uff'
   --out-dir ./bin`). That binary embeds
   its own languages and compiler, so it parses **and** lowers `.uff` to
   **ModuleDeclarations** (`imports` / `exports` / `rules`) under `./bin` in one
   step — no in-tree TypeScript lower stage or frozen compiler snapshot is
   involved.
2. In-tree `uffda compile` (`src/cli/compile.ts`) runs once workspace `./bin`
   already has languages available: parse in-tree, then lower via
   `Resolver.import` of `runtime.compiler.uff` (itself read from `./bin`,
   produced by step 1) — see `compileUffdaSyntaxModule` in
   `src/lang/uffda/execute.ts`.
3. **Runtime resolve** only reads that JSON. It must not re-lower or call the
   runtime compiler again. No recursion.

## Forbidden

- Committing compiler JSON or seeds under `src/`
- Host JS or domain std helpers to paper over missing projection/`./bin` load
- Special-casing `RUNTIME_COMPILER_*` artifact paths instead of normal resolve
- Using in-tree `compile` alone to fill an empty `./bin` (grammar loads from
  `./bin` — that is the chicken/egg; use previous CLI)

## When the published CLI lacks a feature

Publish a CLI that adds the feature, then compile with it. Do not park artifacts
in `src/`. The published `uffda compile` pipeline (parse + lower in one step)
has shipped (0.1.17+); `compile:lang` uses that single previous-CLI step
directly and no wrapper script under `src/cli/` is needed.
