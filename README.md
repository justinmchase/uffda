# Uffda

Uffda is a Deno-based parser generator for domain-specific languages.

Patterns can match strings **and** structured values (objects, arrays, and other
data). That means the whole compiler pipeline—tokenization, parsing, projection,
and lowering—can be expressed as pattern matching.

Language modules under `src/lang/` are authored as `.uff` and compiled to
`./bin` ModuleDeclaration JSON. The published CLI embeds those artifacts, so
bootstrap uses the previous release to compile the next one.

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

From a source checkout (Deno required):

```sh
deno task cli --help
```

## CLI

Running `uffda` with no arguments prints help. Commands:

| Command   | Purpose                                               |
| --------- | ----------------------------------------------------- |
| `compile` | Compile `.uff` modules to ModuleDeclaration JSON      |
| `parse`   | Parse source to a raw AST (`--lang` selects language) |
| `exec`    | Evaluate an expression (source or `--ast`)            |
| `match`   | Match a pattern against `--input` / `--input-json`    |
| `run`     | Run a Uffda module (`--entry` selects an export)      |
| `mcp`     | Start the MCP server and session/display tools        |
| `lsp`     | Start the Language Server Protocol stdio server       |

Languages for `parse`: `uffda` (default), `pattern`, `expression`.

### Quick start

```sh
# Expression eval
uffda exec -e '(echo "Hello, world!")'

# Pattern match (text or JSON subject)
uffda match -e 'any' --input hello
uffda match -e 'number' --input-json 42 --json

# Parse → exec pipeline
uffda parse --lang expression -e '(echo "Hello, world!")' |
  uffda exec --ast

# Compile a module; run selects an export (first export by default)
uffda compile ./examples/morse/morse.uff
uffda run ./app.uff --entry Main
```

See [`examples/morse/morse.uff`](./examples/morse/morse.uff) for a full grammar.
Use `--help` on any command for flags (`uffda match --help`, …).

### Compile layout

```sh
uffda compile 'src/**/*.uff'
uffda compile ./file.uff --out-dir ./out
```

Writes ModuleDeclaration JSON under `<out-dir>/ast` (default `.uffda/ast`). In
this repo, `deno task compile:lang` builds workspace `./bin` with the **previous
published** CLI (bootstrap recursion break).

### MCP server

`uffda mcp` starts the stdio MCP server. Use the `uffda_session_*` tools plus
the display surface for live session loading, evaluation, inspection, and
rendering.

### Language server

`uffda lsp` starts a stdio Language Server Protocol server. It publishes
diagnostics for `.uff` documents on `didOpen`/`didChange`/`didClose`, reusing
incremental re-parsing so edits only reprocess the affected region. A
workspace's `<workspace>/.uffda/lsp.jsonc` can declare additional languages;
`.uff` is always available even without one. See
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

JSR package `@justinmchase/uffda` — entry `mod.ts`. Prefer Deno / Web Platform
APIs. Specs live under `.agents/specifications/`; requirements under
`.agents/requirements/`.

Example grammar: [`examples/morse/morse.uff`](./examples/morse/morse.uff).

## Development

```sh
deno task pre          # fmt, lint, test, jsr dry-run
deno task test         # compile:lang then deno test
deno task compile:lang # previous published uffda → ./bin
deno task cli --help   # in-tree CLI
```

### Maintainers: publish a CLI release

Release tags are bare SemVer (for example `0.2.0`), matching Release Drafter.

1. Merge to `main` so Release Drafter updates the draft, bumps version files,
   and dispatches `release-binaries`.
2. Confirm `uffda-*`, `SHA256SUMS`, and `install.sh` on the draft (re-run
   **Release Binaries** from Actions if needed).
3. Publish the draft. That becomes the latest install target and triggers JSR
   publish.

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
