# MorseLang example

- `morse.uff` — source-authored grammar
- `morse.uff.ast.json` — ModuleDeclaration fixture for fast remport unit tests

After editing `morse.uff`, regenerate the fixture:

```sh
uffda compile examples/morse/morse.uff
cp bin/ast/examples/morse/morse.uff.ast.json examples/morse/morse.uff.ast.json
```

Full-source parse timing is measured by `deno task perf`
(`test/perf/morse-compile.report.ts`), not by the default Rust unit suite.
