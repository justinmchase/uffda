# Requirements

Requirement documents refine the higher-level spec into narrower, testable
statements.

## Relationship to the spec

- Specs in `spec/` define the higher-level contract.
- Requirements in `.github/requirements/` derive from those specs.
- Each requirement should cite the spec file and section it refines.
- If a requirement conflicts with the spec, the spec wins until it is updated.

## Layout

```text
.github/requirements/
  {topic}/
    {name}.requirement.md
```

Use topic folders that follow the spec structure when practical.
