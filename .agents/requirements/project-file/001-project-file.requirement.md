---
id: project-file-001
title: uffda.jsonc is found upward, validated in full, and its languages settle to one owner per id and extension
spec_ref: ".agents/specifications/languages/project-file.spec.md"
---

# Project File

## Requirement

Preconditions:

- A tool (the CLI, the MCP server or the language server) starts in a directory.

Expected behavior:

- The project file MUST be the nearest file named `uffda.jsonc` in that
  directory or an ancestor. A directory named `uffda.jsonc` MUST be passed over.
  With none, there is no project and no problem.
- The file MUST be parsed as JSONC. A parse failure, or a value that is not an
  object, MUST be reported as the file's only problem.
- Every other problem MUST be reported, each with a message naming the field and
  the expected form:
  - a field other than `imports`, `exports` and `languages`;
  - `imports` that is not an object, a key that is not a module name, or a value
    that is not a `jsr:` specifier;
  - two aliases where one is the start of the other, segment by segment;
  - `exports` that is not an object, a key other than `"."` or a `./` name, or a
    value that is not a `./` path;
  - `languages` that is not an array, an entry that is not a module specifier, a
    module name no alias covers, or a repeated entry.
- Specifiers MUST be validated by the module specifier grammar
  (`ModuleSpecifierText` in `src/lang/uffda/specifier.rules.uff`), not a
  separate pattern.
- Each relative `languages` entry MUST be resolved against the project root and
  compiled in memory with the relative modules it imports. A module name or
  `jsr:` entry MUST be reported as "loading languages from packages is not
  supported yet".
- Each exported rule of the module carrying `[Language]` declares a language
  whose grammar is that rule. Malformed `[Language]` metadata MUST be reported
  naming the rule; a module with no such rule MUST be reported.
- An entry's problems MUST NOT stop the other entries from loading.
- Ownership MUST settle as the spec describes: a project language takes over an
  id or extension of the built-in `.uff` language, and an id or extension two or
  more project languages claim is reported and kept by none of them.

Postconditions:

- `loadProjectLanguages(start)` in `src/cli/project_languages.ts` returns the
  project (when valid), the languages to serve, and every problem; the language
  server and `uffda fmt` both use it.
- Tests: `src/project/project.test.ts`, `src/project/load.test.ts`,
  `src/cli/project_languages.test.ts`, `src/cli/module_graph.test.ts`,
  `src/lang/uffda/specifier.test.ts`.
