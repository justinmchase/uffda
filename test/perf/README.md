# `test/perf/`

Ad hoc reports for investigating and guarding against compile/parse-time
regressions — distinct from `test/bench/`'s throughput micro-benchmarks and
`test/integration/`'s correctness end-to-end tests. Reports here measure how
long something takes to _run_ across a range of input sizes, to make superlinear
scaling visible rather than requiring a from-scratch profiling session each time
it's suspected.

- `morse-compile.report.ts` — measures how long `uffdaGrammar` takes to parse
  `.uff` source text as a function of source size, using
  `examples/morse/morse.uff`. Written after a real regression where compiling
  that ~6KB grammar took ~90 seconds (root-caused and fixed — see the header
  comment in the report itself for the full story). Run with `deno task perf`.

## Output behavior

- **Locally**: terse by default — a single line, unless the full compile falls
  outside the report's generous expected-time bound, in which case the full
  size/time breakdown prints automatically. Pass `--verbose` to always see the
  full breakdown.
- **In CI** (`GITHUB_STEP_SUMMARY` set): the full size/time table is always
  attached to the job summary, in addition to the terse console line. This runs
  as its own parallel `Perf` job (see `.github/workflows/checks.yml`), alongside
  the `Integration` job, so it never blocks fast feedback from the main `Checks`
  job. It does not fail the build today — it exists to make a regression
  visible, not to gate merges.
