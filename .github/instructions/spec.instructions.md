---
description: "Multi-file specification authoring for Uffda. Use when creating or editing spec documents."
applyTo: "spec/**/*.md"
---

# Multi-file specification instructions

The Uffda spec is a set of focused documents rather than a single monolithic
file.

## Scope and hierarchy

- Spec files describe the high-level contract for the parser generator, runtime,
  and language behavior.
- Requirement files are narrower, more directly testable statements derived from
  the spec.
- Do not move requirement-level detail into the spec unless the detail changes
  the high-level contract.

## File layout

```text
spec/
  README.md
  {topic}.spec.md
```

- `spec/README.md` is the canonical index and explains how the spec set is
  organized.
- Each `{topic}.spec.md` file should cover one concern or closely related set of
  concerns.
- Prefer adding a new small spec file over growing an existing file into a
  catch-all document.

## Naming and organization

- Use kebab-case file names.
- Name files by concern, such as `grammar.spec.md`, `matching.spec.md`, or
  `runtime.spec.md`.
- Cross-link related spec files when one topic depends on another.

## Authoring expectations

- Start each spec file with a short statement of scope.
- Record the rules, guarantees, or invariants that matter to readers and future
  requirement authors.
- Keep prose implementation-agnostic when possible.
- Call out open questions explicitly instead of implying a requirement that has
  not been decided yet.
- When a spec change implies a more specific behavior to verify later, capture
  that follow-on work in `.github/requirements/` rather than expanding the spec
  into low-level acceptance criteria.
