# Language-selection and output contracts

This chapter defines language-mode selection and output-shape guarantees for the
Uffda CLI.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Language-mode selection

- The CLI MUST support full Uffda language compilation mode.
- The CLI MUST support pattern language compilation mode.
- The CLI MUST support expression language compilation mode.
- Full Uffda mode MUST be the default when no language-selection flag is
  supplied.
- If multiple mutually exclusive language flags are supplied, the CLI MUST fail
  with deterministic diagnostics.
- Parse command parsing and diagnostics MUST use the selected language mode.

## Output kind selection

- The CLI MUST support output forms for at least:
  - syntax AST payloads;
  - diagnostics payloads.
- Output forms MUST be explicitly selectable by flags or command family.
- Machine-readable output mode MUST be stable for fixed version and inputs.

## Execution output

- The `exec` command MUST execute expressions, the `match` command MUST apply
  patterns, and the `run` command MUST execute Uffda modules.
- Operational commands MUST accept raw selected-language AST JSON only with
  explicit `--ast` rather than a CLI-specific artifact envelope.
- String execution results MUST be suitable for direct shell-pipeline output.

## JSON stability and compatibility

- JSON output MUST be valid UTF-8 text.
- JSON output MUST preserve the selected language's syntax AST shape without
  CLI-specific wrapper metadata.
- Breaking JSON shape changes MUST be documented.

## Diagnostics in multi-language contexts

- Diagnostics MUST identify the selected language mode and relevant phase
  boundary.
- Diagnostics SHOULD include source location and module provenance where
  available.
- Parse diagnostics MUST identify the selected language mode.

## Composition intent

- Language-selection and output contracts SHOULD allow operators to use one CLI
  surface for heterogeneous Uffda-layer workflows.
