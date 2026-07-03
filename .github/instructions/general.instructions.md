---
description: "General repository conventions for Uffda. Use when writing code, specs, requirements, or contributor docs."
applyTo: "**"
---

# Repository instructions

Uffda is a Deno-based parser generator for domain specific languages.

## Runtime and dependency conventions

- Prefer Deno-native and Web Platform APIs over Node.js APIs.
- Default to ESM TypeScript.
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
- Keep modules small and composable when adding or refactoring parser logic.

## Specification authority and change control

Apply this strict authority order when implementing or evaluating behavior:

1. Spec documents (`spec/**/*.md`)
2. Requirement documents (`.github/requirements/**/*.requirement.md`)
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

- The spec is split across multiple smaller Markdown files under `spec/`.
- `spec/README.md` is the entry point and index for the spec set.
- Normative spec chapters use the `{topic}.spec.md` naming pattern.
- Requirement documents should reference the spec file and section they refine.
