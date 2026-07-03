---
description: "Requirement authoring for Uffda. Use when creating or editing requirement documents."
applyTo: ".github/requirements/**/*.md"
---

# Requirement authoring instructions

Requirement documents refine the higher-level spec into specific, testable
statements.

## Authority and scope

- Requirements are subordinate to the spec in `spec/`.
- Every requirement should trace back to a spec file and section.
- Use requirements for concrete behaviors that can later be validated with
  tests.
- If the spec and a requirement disagree, update the spec first or resolve the
  conflict before changing tests or implementation.

## Layout

```text
.github/requirements/
  {topic}/
    {name}.requirement.md
```

- Use topic folders that follow the relevant spec chapter when practical.
- Keep one requirement per file.
- Use descriptive kebab-case file names ending in `.requirement.md`.

## Authoring expectations

- State the behavior in plain language.
- Include constraints, preconditions, and expected outcomes.
- Keep the document narrower and more testable than the spec text it refines.
- Cite the source spec file and section so future work can trace the rationale.
