---
id: cli-command-model-003
title: CLI working-directory and resolver-root resolution are deterministic
spec_ref: ".agents/specifications/languages/cli/command-model.spec.md#resolver-and-working-directory-contract"
---

# CLI Working Directory and Resolver Root Resolution

## Requirement

Preconditions:

- A CLI invocation includes process working directory and may include `--cwd`
  and `--resolver-root` options.

Expected behavior:

- Effective working directory MUST resolve deterministically.
- Resolver root MUST resolve deterministically relative to effective working
  directory when provided as relative path.
- Absolute resolver-root values MUST be preserved.
- Invalid process path context MUST fail before command execution with
  deterministic configuration diagnostics.

Postconditions:

- CLI command execution context is reproducible for fixed arguments and process
  environment.
