# Uffda specification

> [!NOTE]
> **Status: Pending** — No specification chapters have been authored yet. The
> files and structure described below represent the intended layout; individual
> `{topic}.spec.md` chapters are still to be written.

This directory holds the Uffda specification as a set of smaller documents.

## Principles

- Specs are higher level than requirements.
- Specs define the contract for the parser generator, matching model, and
  runtime behavior.
- Requirements will live under `.github/requirements/` and should refine
  individual parts of these specs into directly testable statements.

## Layout

```text
spec/
  README.md
  {topic}.spec.md
```

## Authoring pattern

- Keep each spec file focused on a single concern or tightly related concerns.
- Use `{topic}.spec.md` in kebab-case for normative chapters.
- Add new chapter files as the spec grows instead of building a single large
  document.
- Link related chapters when behavior spans multiple topics.
- Reserve low-level acceptance details for requirement documents, not spec
  chapters.

## Expected future flow

1. Define or update the relevant high-level spec chapter in `spec/`.
2. Add or update derived requirement files in `.github/requirements/`.
3. Implement and test behavior against those requirements.
