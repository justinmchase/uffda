# Project file

This chapter defines `uffda.jsonc`, the Uffda project file. The CLI, the MCP
server and the language server all read it. It declares the project's module
aliases, what the project exports, and the languages the project uses.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Location

- The project file MUST be named `uffda.jsonc` and hold JSON with comments. No
  other name (for example `uffda.json`) is a project file.
- A project's root is the nearest directory at or above the starting directory
  (the working directory, or the editor's workspace folder) that holds a file
  named `uffda.jsonc`. A directory named `uffda.jsonc` is not a project file.
- One project serves a whole workspace. Nested project files below the root are
  not read for that workspace.
- A directory with no project file at or above it has no project. Every tool
  MUST still work there with only the built-in languages.

## Shape

```jsonc
{
  // Aliases for packages. Each maps to a jsr: specifier.
  "imports": { "@acme/kv": "jsr:@acme/kv@^1.2.0" },

  // Export name to a file inside the project. "." is the default export.
  "exports": { ".": "./src/mod.uff", "./lang": "./src/kv.uff" },

  // Modules whose exported rules carry [Language] metadata.
  "languages": ["./src/lang/foo.uff", "@acme/kv/lang"]
}
```

- The file MUST hold an object whose fields are only `imports`, `exports` and
  `languages`, each optional. Any other field is a problem.
- Specifiers are read with the module specifier grammar of
  [imports](./uffda-syntax/imports.spec.md#module-specifiers), exactly as they
  read between an import's quotes.
- Every problem in the file MUST be reported, not only the first. A project file
  with any problem MUST NOT be used: the tools fall back to the built-in
  languages and report the problems.

## Imports

- `imports` maps module names to packages. Each key MUST be a module name (`@`
  form) and each value a `jsr:` specifier.
- An alias MUST NOT be the start of another alias, segment by segment (`@acme`
  and `@acme/kv` overlap; `@acme/kv` and `@acme/kvx` do not). Every overlapping
  pair is a problem.
- `imports` is a local development map. Compiled modules name packages by their
  full `jsr:` specifier, so a project's consumers never read its `imports`.

## Exports

- `exports` maps export names to files. Each key MUST be `"."` (the default
  export) or a `./` name, and each value a `./` path inside the project.
- A consumer naming `@pkg/<name>` gets the file `exports["./<name>"]`, and
  `@pkg` gets `exports["."]`.

## Languages

- `languages` MUST be an array of module specifiers, each listed once. A module
  name MUST fall under an alias `imports` declares.
- Listing a module is an explicit declaration, not auto-discovery: the tools
  serve exactly the languages the listed modules declare, plus the built-in
  `.uff` language, which is always available and needs no entry.
- A module declares languages through `[Language]` metadata on its exported
  rules (see
  [editor metadata](./cli/editor-metadata.spec.md#language-metadata)). Each
  decorated exported rule declares one language and is that language's entry
  rule. A listed module that exports no rule with `[Language]` metadata is a
  problem.
- `[Language]` MUST supply a stable short `id` and the file `extensions` the
  language owns, and MAY supply a display `name` and a `description`. The
  module's metadata is the only source of these facts: the project file has no
  per-language overrides.
- Each id and each extension MUST belong to at most one language. A project
  language takes an id or extension over from the built-in language. An id or
  extension two or more project languages claim is a problem naming them, and
  none of those languages keeps it; every other language and extension stays
  served.
- A listed module that cannot be read, compiled or resolved is a problem naming
  its entry. The other entries still load.
- Relative entries are resolved against the project root and compiled in memory
  with the modules they import, so a project's grammars need no compiled
  artifacts. Loading entries from packages (module names and `jsr:` specifiers)
  is not supported yet and MUST be reported as a problem for that entry.

## Related

- [imports](./uffda-syntax/imports.spec.md) — the module specifier grammar.
- [language server](./cli/language-server.spec.md#language-configuration) — how
  the server serves a project's languages.
- [formatting](./cli/formatting.spec.md#languages) — how `uffda fmt` picks a
  file's language.
- GitHub issue #235 — origin of this chapter. GitHub issue #234 — external
  module loading.
