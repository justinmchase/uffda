# Uffda

Uffda is a parser generator for domain specific languages.

It is different from many parser generators in that the syntax is expressive
enough to support parsing strings as well as objects, arrays or any other value
type. The result of this capability is that the entire compiler pipeline can be
expressed in pattern matching operations.

## CLI

Run the CLI from a checkout with `deno task cli`. Use `--help` for the command
overview or command-specific help such as `deno task cli match --help`.

### Install a release binary

Linux hosts can install from GitHub Releases:

```sh
curl -fsSL https://github.com/justinmchase/uffda/releases/latest/download/install.sh | bash
```

GitHub Actions workflows should use the in-repo setup action, which selects the
matching binary for the runner OS and architecture:

```yaml
- uses: justinmchase/uffda/.github/actions/uffda-setup@main
  with:
    version: latest
```

Cross-compile every Deno target locally with `deno task compile:cli` (writes
binaries and `SHA256SUMS` under `dist/cli/`).

### Publish a CLI release

Release tags are bare SemVer (for example `0.1.2`), matching Release Drafter.

1. Merge to `main` so Release Drafter updates the draft release, bumps version
   files, and dispatches `attach-draft-cli-binaries`.
2. The **Attach Draft CLI Binaries** workflow compiles all Deno targets and
   attaches/replaces `uffda-*`, `SHA256SUMS`, and `install.sh` on the latest
   draft (re-run it manually from Actions if you need to rebuild).
3. Publish the draft release when ready. That makes it the latest install target
   for `install.sh` / `uffda-setup` and triggers JSR publish.

### Hello World

Evaluate an expression directly with `-e`:

```sh
deno task cli exec -e '(echo "Hello, world!")'
```

```text
Hello, world!
```

### Useful commands

Parse source to a raw AST, then execute it explicitly as an AST pipeline:

```sh
deno task cli parse --lang expression -e '(echo "Hello, world!")' |
  deno task cli exec --ast
```

Match text with `--input`, or match one decoded JSON value with `--input-json`.
Add `--json` when a script needs machine-readable results and diagnostics:

```sh
deno task cli match -e 'any' --input hello
deno task cli match -e 'number' --input-json 42 --json
```

Run a Uffda module with its first export, or select an exported rule with
`--entry`:

```sh
deno task cli run ./app.uff --entry Main
```

### Workbench

On a terminal, `workbench` opens a fullscreen TUI: pick a workspace folder,
browse files, edit source, and toggle a compile/diagnostics preview with
`Shift+Tab`. Pass a source path to skip the landing screen and open that file
directly:

```sh
deno task cli workbench
deno task cli workbench ./examples/main.uff
```

When standard input is piped, the same session uses a newline-delimited JSON
protocol for automation (`open`, `save`, `export-ast`, `visualize`, `match`, and
related actions):

```sh
printf '%s\n' \
  '{"action":"start","language":"pattern","source":"any"}' \
  '{"action":"set-source","source":"number"}' \
  '{"action":"end"}' |
  deno task cli workbench
```

## Development

This is a deno library.

#### test

```sh
deno test --watch --parallel
```

### References

This project is based on a previous project I made called Meta# which was a C#
implementation of the ideas written in the OMeta paper by
[Alessandro Warth](http://www.tinlizzie.org/~awarth/).

> OMeta’s key insight is the realization that all of the passes in a traditional
> compiler are essentially pattern matching operations
>
> ~ Experimenting with Programming Languages, Alessandro Warth 2009

- [Experimenting with Programming Languages](http://www.vpri.org/pdf/tr2008003_experimenting.pdf)
- [ohm-js](https://ohmlang.github.io/)
- [meta#](https://archive.codeplex.com/?p=metasharp)
