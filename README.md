# Uffda

Uffda is a parser generator for domain-specific languages. The production CLI
and runtime are the Rust `uffda` binary. The former Deno runtime and CLI are
retired; compatibility fixtures remain as Rust regression tests.

Patterns can match strings **and** structured values (objects, arrays, and other
data). That means the whole compiler pipeline—tokenization, parsing, projection,
and lowering—can be expressed as pattern matching.

Language modules under `src/lang/` are authored as `.uff` and compiled to
`./bin` ModuleDeclaration artifacts. The on-disk data-codec form uses the
`.uff.ast` extension; a `.uff.ast.json` sibling is still written during
migration. The published CLI embeds those artifacts, so bootstrap uses the
previous release to compile the next one.

## Install

Linux (x86_64 or aarch64):

```sh
curl -fsSL https://github.com/justinmchase/uffda/releases/latest/download/install.sh | bash
```

Installs `uffda` to `~/.local/bin` by default. Put that directory on your
`PATH`, then:

```sh
uffda --version
uffda --help
```

GitHub Actions:

```yaml
- uses: justinmchase/uffda/.github/actions/uffda-setup@main
  with:
    version: latest
```

From a source checkout (Rust toolchain and a published `uffda` required):

```sh
uffda compile 'src/lang/**/*.uff'
cargo run --locked --manifest-path rust/Cargo.toml --features embed-languages --bin uffda -- --help
```

## CLI

Running `uffda` with no arguments prints help. Commands:

| Command   | Purpose                                               |
| --------- | ----------------------------------------------------- |
| `compile` | Compile `.uff` modules to ModuleDeclaration artifacts |
| `parse`   | Parse source to a raw AST (`--lang` selects language) |
| `exec`    | Evaluate an expression (source or `--ast`)            |
| `match`   | Match a pattern against text, JSON, or codec data     |
| `run`     | Run a Uffda module (`--entry` selects an export)      |
| `mcp`     | Start the MCP server and session/display tools        |
| `lsp`     | Start the Language Server Protocol stdio server       |

Languages for `parse`: `uffda` (default), `pattern`, `expression`.

### Quick start

```sh
# Expression eval
uffda exec -e '(echo "Hello, world!")'

# Pattern match (text, JSON, or codec data subject)
uffda match -e 'any' --input hello
uffda match -e 'number' --input-json 42 --json
uffda match -e 'any' --input-data '@set[1 2]'
uffda run ./app.uff --entry Main --input-data-file ./subject.data

# Parse → exec pipeline
uffda parse --lang expression -e '(echo "Hello, world!")' |
  uffda exec --ast

# Compile a module; run selects an export (first export by default)
uffda compile ./examples/morse/morse.uff
uffda run ./app.uff --entry Main
```

See [`examples/morse/morse.uff`](./examples/morse/morse.uff) for a full grammar.
Use `--help` on any command for flags (`uffda match --help`, …).

### Runtime value input and output

The Rust CLI's `exec`, `match`, and `run` emit one compact
[Uffda data codec](.agents/specifications/data-codec/values.spec.md) record plus
newline by default. Strings are quoted and escaped (including top-level
strings), and undefined emits `undefined`. Codec values include fractional and
non-finite numbers, BigInt, Date, bytes, registry symbols, Set, Map, and Error.
Encoding never invokes conversion hooks; unsupported values, cycles and shared
composite references fail explicitly. Use `--json` for existing JSON value
output instead.

`match` and `run` accept exactly one subject mode:

| Option                     | Subject                                   |
| -------------------------- | ----------------------------------------- |
| `--input <text>`           | Text matched character by character       |
| `--input-file <path>`      | File contents matched as text             |
| `--input-json <json>`      | One decoded JSON value                    |
| `--input-data <data>`      | One decoded codec value                   |
| `--input-data-file <path>` | One decoded codec value from a UTF-8 file |

All subject options are mutually exclusive, including repeats. Data options
accept comments and multiline containers, but reject empty or multiple records
and executable syntax. They never evaluate expressions or interpolate strings.
Strings and arrays decoded from codec data match as one scalar value, not an
implicit input sequence. Codec decoding uses the default 16 MiB record-byte and
1,024 nesting-depth limits.

Program source (`-e`, a path, or stdin) and `--ast` program JSON are separate
from subject options. For example, runtime output can round-trip without
executing it as a program:

```sh
uffda exec -e '"hello"' |
  uffda match -e any --input-data-file /dev/stdin
```

Parse output, project/lockfile files, and structured diagnostics remain JSON.
Compiled ModuleDeclarations use the Uffda data codec on disk: the file extension
is `.uff.ast` (one codec record per module). Compile also writes a
`.uff.ast.json` sibling while resolvers and embeds migrate off JSON.

### Compile layout

```sh
uffda compile 'src/**/*.uff'
```

Writes ModuleDeclaration artifacts under `<outDir>/ast`, mirroring each source's
path in the project: `src/foo.uff` becomes both `bin/ast/src/foo.uff.ast` (data
codec) and `bin/ast/src/foo.uff.ast.json` (JSON). Resolvers prefer
`.uff.ast.json` when present and fall back to `.uff.ast`. `outDir` is `./bin`
unless the project file says otherwise, and `run`, `exec`, the language server
and MCP sessions read compiled imports from the same place. Build output is
never written next to sources. In this repo, `deno task compile:lang` builds
workspace `./bin` with the **previous published** CLI (bootstrap recursion
break).

### Project file

A `uffda.jsonc` file marks a Uffda project. Tools use the nearest one at or
above the working directory (or the editor's workspace), or the file
`--config <path>` names:

```jsonc
{
  // Module names for packages. Each one maps to a jsr: specifier.
  "imports": { "@acme/kv": "jsr:@acme/kv@^1.2.0" },
  // What the project offers to others, "." or "./name" to a file inside it.
  "exports": { ".": "./lang/foo.uff" },
  // Modules whose exported rules carry [Language] metadata.
  "languages": ["./lang/foo.uff"],
  // Where compiled artifacts go. Defaults to "./bin".
  "outDir": "./bin"
}
```

A language's id, name and file extensions come from the `[Language]` decorator
on the exported rule that parses its files, for example
`[Language { id: "foo", name: "Foo", extensions: [".foo"] }]`. `.uff` is always
available, even without a project file.

An import may name a module name (`import "@acme/kv/tokens" Token;`). The
resolver looks it up in `imports`, as Deno does with `deno.json`, and
`uffda compile` writes it out in full (`"jsr:@acme/kv@^1.2.0/tokens"`), so
compiled modules never need the project file. See
[`project-file.spec.md`](.agents/specifications/languages/project-file.spec.md).

A `jsr:` module is loaded from [JSR](https://jsr.io): the highest version
matching the range, the `.uff` file its `uffda.jsonc` exports, and that file's
compiled artifact from the package's `outDir`. Every file is checked against the
package's manifest and cached under `~/.cache/uffda/jsr` (or `XDG_CACHE_HOME` /
`LOCALAPPDATA`). The versions chosen are recorded in `uffda.lock` beside
`uffda.jsonc`; commit it. A package must therefore publish its `uffda.jsonc` and
compiled `outDir` (JSR leaves out gitignored files unless `publish.exclude`
un-ignores them, as in `"!bin"`). This package exports its tokenizer that way:
`import "jsr:@justinmchase/uffda/tokenizer" Tokenizer;`. See
[`modules.spec.md`](.agents/specifications/modules.spec.md#packages).

The reusable grammar exports also include `source`, `tokenizer-lang`, `pattern`,
`pattern-syntax`, `expression`, `expression-syntax`, `imports`, `exports`, and
`language`. The `pattern` and `expression` modules export their complete
language entry points and raw token-level rules; the `*-syntax` aliases expose
just those raw rules. A tokenizer-driven grammar can compose the shared rules
with its own tokenizer and surrounding syntax:

```uffda
import "jsr:@justinmchase/uffda/pattern-syntax" Pattern;
import "jsr:@justinmchase/uffda/expression-syntax" Expression;
import "jsr:@justinmchase/uffda/imports" ImportDeclarationSyntax;
import "jsr:@justinmchase/uffda/exports" ExportDeclarationSyntax;
export rule PatternAtom = Pattern;
export rule ExpressionAtom = Expression;
```

The `language` export provides `UffdaLang` and its `Language` decorator.

### JSR package (grammars + cutover notice)

`jsr:@justinmchase/uffda` publishes a small package: a root `mod.ts` cutover
notice, `uffda.jsonc`, `.uff` sources, and compiled `./bin` artifacts. It does
**not** publish Deno TypeScript library subpaths (`./grammar`, `./runtime`, …).
Use the Rust CLI for execution; remport grammars as:

```uffda
import "jsr:@justinmchase/uffda/tokenizer" Tokenizer;
import "jsr:@justinmchase/uffda/pattern-syntax" Pattern;
```

```ts
import { CLI_INSTALL, GRAMMARS_NOTE, NOTICE } from "jsr:@justinmchase/uffda";
```

### MCP server

`uffda mcp` starts the stdio MCP server. Use the `uffda_session_*` tools plus
the display surface for live session loading, evaluation, inspection, and
rendering.

### Language server

`uffda lsp` starts a stdio Language Server Protocol server. It publishes
diagnostics for `.uff` documents on `didOpen`/`didChange`/`didClose`, reusing
incremental re-parsing so edits only reprocess the affected region. The
languages a project's `uffda.jsonc` lists are served too; `.uff` is always
available even without one. See
[`language-server.spec.md`](.agents/specifications/languages/cli/language-server.spec.md)
for the full contract — syntax highlighting and hover/navigation/completions are
specified but not yet implemented.

### VS Code extension

[`editors/vscode/`](editors/vscode/) contains the VS Code extension: it
registers `uffda lsp` as the language server for `.uff` files and `uffda mcp` as
an MCP server, resolving/downloading a compatible `uffda` binary automatically.
It's an independently versioned npm package, isolated from this repo's
`deno.jsonc` tasks and CI. See its [README](editors/vscode/README.md) for
development instructions.

## Library

The Rust library is `uffda-runtime`; see [`rust/CRATES.md`](./rust/CRATES.md)
for the runtime, heap, and artifact-embedding crates. JSR `@justinmchase/uffda`
ships grammars and a notice entry point, not a TypeScript runtime. Specs live
under `.agents/specifications/`; requirements under `.agents/requirements/`.

Example grammar: [`examples/morse/morse.uff`](./examples/morse/morse.uff).

## Development

```sh
deno task pre          # formatting, helper lint/tests, Rust checks, JSR dry-run
deno task test         # compile:lang, Rust workspace tests, Deno helper tests
deno task compile:lang # previous published uffda → ./bin
deno task cli --help   # in-tree Rust CLI (requires bootstrapped ./bin)
deno task compile:cli  # bootstrap then build optimized Rust CLI
```

Without Deno, bootstrap with `uffda compile 'src/lang/**/*.uff'`, then run
`cargo xtask check`. Deno remains for JSR publishing, repository formatting,
release/setup helpers, and optional Rust codec measurements. TypeScript also
remains in the independently built VS Code extension.

### Maintainers: publish a CLI release

Release tags are bare SemVer (for example `0.2.0`). The standalone **Draft
Release** workflow uses GitHub's built-in release notes generator. PR creators
choose version labels: `major` takes precedence over `minor`; otherwise the next
release is a patch. Labels are considered across merged PRs since the latest
stable published release tag, not since the last draft update. The workflow does
not automatically label PRs.

1. Merge to `main` so **Draft Release** updates the draft, bumps version files,
   and dispatches `release-binaries`.
2. Confirm `uffda-*`, `SHA256SUMS`, and `install.sh` on the draft (re-run
   **Release Binaries** from Actions if needed). Do **not** publish until those
   assets are attached — an empty published release breaks install and JSR
   bootstrap. If a draft was published too early with no CLI assets, re-run
   **Release Binaries** with workflow input `tag` set to that version.
3. Publish the draft. That becomes the latest install target and triggers JSR
   and crates.io publish.

## Acknowledgments

Large parts of the Rust runtime, CLI, and test migration were developed with
[Cursor](https://cursor.com) (AI-assisted editing and agents), under human
review and direction. Commit and PR history remain the source of truth for
individual changes.

## References

Based on ideas from OMeta
([Alessandro Warth](http://www.tinlizzie.org/~awarth/)) and an earlier C#
project, Meta#.

> OMeta’s key insight is the realization that all of the passes in a traditional
> compiler are essentially pattern matching operations
>
> ~ Experimenting with Programming Languages, Alessandro Warth 2009

- [Experimenting with Programming Languages](http://www.vpri.org/pdf/tr2008003_experimenting.pdf)
- [ohm-js](https://ohmlang.github.io/)
- [meta#](https://archive.codeplex.com/?p=metasharp)
