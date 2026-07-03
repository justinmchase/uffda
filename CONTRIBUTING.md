# Contributing to Uffda

Thanks for your interest in contributing.

## Ground rules

- Keep changes focused — one concern per PR.
- Follow `deno fmt`, `deno lint`, and `deno task test` before submitting.
- **Every implementation change MUST align with the spec.** If parser behavior,
  matching behavior, runtime behavior, or externally visible semantics change,
  and that change is not already documented in `spec/` or
  `.github/requirements/`, include the corresponding documentation updates in
  the same PR.
- Specs are higher level than requirements. Requirements should refine spec
  chapters rather than replace them.

## Spec alignment checklist (required in PR description)

- [ ] I confirmed this change is consistent with `spec/README.md` and the
      impacted `spec/*.spec.md` files.
- [ ] If behavior was not already covered, I updated the relevant spec and/or
      requirement documents.
- [ ] I listed the impacted spec and requirement files in the PR description.

## Development

```sh
deno fmt
deno lint
deno task test
```

## Repository layout

```text
spec/                   High-level specification documents
.github/requirements/   Requirement documents derived from the spec
src/                    Library implementation (Deno/TypeScript)
mod.ts                  Public entry point
```
