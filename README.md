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

Running `uffda` with no arguments opens the workbench. Commands:

| Command     | Purpose                                               |
| ----------- | ----------------------------------------------------- |
| `compile`   | Compile `.uff` modules to ModuleDeclaration JSON      |
| `parse`     | Parse source to a raw AST (`--lang` selects language) |
| `exec`      | Evaluate an expression (source or `--ast`)            |
| `match`     | Match a pattern against `--input` / `--input-json`    |
| `run`       | Run a Uffda module (`--entry` selects an export)      |
| `workbench` | Interactive TUI editor / JSON automation protocol     |

Languages for `parse` / `workbench`: `uffda` (default), `pattern`, `expression`.

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

### Workbench

Fullscreen TUI: browse a folder, edit source, toggle compile/diagnostics with
`Shift+Tab`. Pass a path to open a file directly:

```sh
uffda workbench
uffda workbench ./examples/morse/morse.uff
```

Piped stdin uses a newline-delimited JSON protocol (`open`, `save`,
`export-ast`, `visualize`, `match`, …):

```sh
printf '%s\n' \
  '{"action":"start","language":"pattern","source":"any"}' \
  '{"action":"set-source","source":"number"}' \
  '{"action":"end"}' |
  uffda workbench
```

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
