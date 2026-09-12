# `test/`

Slow, out-of-band test/benchmark suites that don't belong in the fast default
`deno task test` loop, kept out of `src/` so they can't be mistaken for library
code.

- `test/integration/` — full end-to-end compile/parse integration tests
  (whole-language compiles, large real-text roundtrips). These are slow
  (multiple minutes) relative to the rest of the suite and are excluded from
  `deno task test`/`deno task pre`. Run them explicitly with
  `deno task test:integration`, or via CI's separate `Integration` job (see
  `.github/workflows/checks.yml`), which runs in parallel with the main `Checks`
  job so slow full-compile tests never block fast feedback on lint/format/unit
  tests.
- `test/bench/` — `deno bench` suites and footprint reports. Run with
  `deno task bench` / `deno task bench:memo`. Runs as its own parallel `Bench`
  job in CI (informational only — shared runners are too noisy for reliable
  throughput regression gating), attaching output to the job summary.
- `test/perf/` — ad hoc perf-investigation reports (compile-time scaling, not
  throughput). Run with `deno task perf`; see `test/perf/README.md`. Runs as its
  own parallel `Perf` job in CI, attaching results to the job summary.

Files here are excluded from the published JSR package (`publish.exclude` in
`deno.jsonc`) — they are not part of the library's export graph.

Requirement-linked tests that live here (rather than mirroring their
`.agents/requirements/<topic>/` folder under `src/requirements/<topic>/`, which
is the default convention) still cite their requirement id and doc path in a
header comment for traceability — see
`test/integration/006-canonical-morse-language.requirement.test.ts`.
