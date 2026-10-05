# Project file

This chapter defines `uffda.jsonc`, the Uffda project file. The CLI, the MCP
server and the language server all read it. It declares the project's module
aliases, what the project exports, the languages the project uses, and where its
compiled artifacts go.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Location

- The project file MUST be named `uffda.jsonc` and hold JSON with comments. No
  other name (for example `uffda.json`) is a project file.
- A project's root is the nearest directory at or above the starting directory
  (the working directory, or the editor's workspace folder) that holds a file
  named `uffda.jsonc`. A directory named `uffda.jsonc` is not a project file.
- A command MAY name its project file explicitly (`--config <path>` on the CLI,
  `config` on MCP tools); that file is used whatever its name, and a missing one
  is a problem.
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
  "languages": ["./src/lang/foo.uff", "@acme/kv/lang"],

  // Directory compiled artifacts are written to. Defaults to "./bin".
  "outDir": "./bin"
}
```

- The file MUST hold an object whose fields are only `imports`, `exports`,
  `languages` and `outDir`, each optional. Any other field is a problem.
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
- `imports` is the import map of every resolver the project's tools build (see
  [import maps](../modules.spec.md#import-maps)): the CLI, the language server
  and the MCP server load it before resolving any import, as Deno loads
  `deno.json`.
- `imports` is a local development map. `uffda compile` writes each module name
  out as its full `jsr:` specifier (see
  [compile](./cli/compile-and-stream.spec.md#ast-artifact-contracts)), so a
  project's consumers never read its `imports`.

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

## Output directory

- `outDir` MUST be a `./` path inside the project, as in `"./bin"`. It defaults
  to `./bin`.
- A project's artifact layout is its root and its output directory: the source
  `<root>/<path>.uff` compiles to `<outDir>/ast/<path>.uffda.ast.json`. A
  directory with no project uses the working directory (the language server: its
  workspace folder) as its root, with `./bin`.
- Build output MUST NOT be written next to sources: every compiled artifact goes
  under the output directory.
- Every tool MUST write and read artifacts through that layout: `uffda compile`
  and the MCP `uffda_compile` tool write there, and every resolver the project's
  tools build (`run`, `exec`, MCP sessions, the language server) reads `.uff`
  imports from there and compiles missing ones into it. No command argument
  changes the layout, because a module's importers could not see it.
- A source outside the project root has no place in the layout. Compiling it, or
  resolving an import of it, MUST fail naming the module and the root.
- `outDir` is how a published package's consumers find its compiled artifacts.

## Lockfile

- A project's lockfile is `uffda.lock` beside its project file. It holds JSON:

  ```json
  {
    "specifiers": { "jsr:@acme/kv@^1.2.0": "1.2.3" },
    "jsr": { "@acme/kv@1.2.3": { "integrity": "<sha256 hex>" } }
  }
  ```

  - `specifiers` maps each `jsr:@scope/name@range` the project's modules
    resolved to the version chosen for it.
  - `jsr` maps each package version used to the sha256 of its
    `<version>_meta.json`, whose manifest checksums every file of it (see
    [packages](../modules.spec.md#packages)).
- Tools MUST resolve packages through the lockfile and add to it what they
  resolve, writing it with keys sorted. A lockfile that is not that shape is a
  problem, reported like a project file problem.
- The lockfile SHOULD be committed, so every checkout resolves the same
  versions.

## Related

- [imports](./uffda-syntax/imports.spec.md) — the module specifier grammar.
- [language server](./cli/language-server.spec.md#language-configuration) — how
  the server serves a project's languages.
- [formatting](./cli/formatting.spec.md#languages) — how `uffda fmt` picks a
  file's language.
- GitHub issue #235 — origin of this chapter. GitHub issue #234 — external
  module loading.
