---
id: cli-command-model-005
title: Rust CLI preserves reference option ordering and supported command compatibility
spec_ref: ".agents/specifications/languages/cli/command-model.spec.md#mode-selection-precedence-contract; .agents/specifications/languages/cli/command-model.spec.md#input-selection-contract; .agents/specifications/languages/cli/command-model.spec.md#resolver-and-working-directory-contract"
---

# Rust CLI compatibility matrix

## Requirement

Preconditions:

- The Rust preview exposes compile, exec, fmt, match, parse, and run.
- MCP, LSP, installation cutover, and production renaming are excluded from this
  preview matrix; production cutover still requires MCP/LSP on the Rust CLI (see
  `docs/rust-migration.md` milestone 10).

Expected behavior:

- A persistent finite matrix MUST verify all six commands against the reference
  process contract, including each option alone, ordered pairs of validation
  conflicts, missing and empty values, unknown flags, repeated values,
  positional paths, explicit and implicit modes, and long-mode precedence.
- Parsing MUST finish before semantic validation or subject file reads. Repeated
  value options MUST take the last value; distinct subject transports MUST
  remain mutually exclusive. Codec subjects retain their separately specified
  stricter prohibition on repeated subject options
  (`cli-match-002`/`cli-run-004`).
- The runtime matrix MUST exercise applicable source transports (implicit stdin,
  explicit stdin, file, inline aliases, AST stdin and file), parse languages,
  text/JSON/file subjects, run entries, configuration, formatting/check
  behavior, success output, and failures. Both implementations MUST
  independently verify the checked-in expected outcomes.
- Help MUST precede version, which MUST precede normal execution, including
  help/version tokens supplied as option values. Contextual help MUST select the
  last recognized command or mode in the raw argument sequence.
- Effective cwd MUST prefer nonempty INIT_CWD, then nonempty PWD, then the
  operating-system cwd. Relative environment values MUST resolve against the
  operating-system cwd.
- Source parsing MUST precede configuration and subject loading for exec/run;
  match MUST parse its pattern before reading its subject. Parse/match MUST NOT
  load an unrelated project configuration.
- Rightmost match failures MUST distinguish nested indices and property keys
  from their outer container. Nested paths MUST participate in selection when
  original source offsets tie, and machine diagnostics MUST retain those paths.
- Preview help MUST omit deferred integrations and describe the already approved
  codec-record default output. Version values are build metadata, not identical
  across implementations. Existing inline equals-value and native codec-subject
  support MUST remain covered separately rather than removed for compatibility.

Postconditions:

- The matrix is reproducible without changing expected outcomes during testing.
- Tests cite this requirement in Rust parser/process tests and shared Deno
  tests.
- Native parser, filesystem, and runtime diagnostic prose MAY differ from the
  reference. The user explicitly prefers the new Rust error formats:
  unstructured output is not a byte-for-byte compatibility contract. Failure
  comparisons MUST still verify nonempty diagnostic messages and retain every
  structured field, including error code, phase, diagnostic lists, locations,
  paths, outputs, and exit codes. Usage-validation messages remain checked
  exactly.
