# `test/`

Slow, out-of-band suites that don't belong in the fast default `deno task test`
loop, kept out of `src/` so they can't be mistaken for library code.

- `test/bench/` — `deno bench` suites and footprint reports. Run with
  `deno task bench` / `deno task bench:memo`. Checks no longer runs this suite.
- `test/perf/` — ad hoc perf-investigation reports (compile-time scaling and
  on-demand data-codec measurement tooling). Run with `deno task perf`; see
  `test/perf/README.md`. Checks no longer runs these reports.

End-to-end correctness that used to live under `test/integration/` is covered by
Rust lib tests (for example Morse in `rust/src/lang_tests/uffda.rs` and format
round-trips in `rust/src/format.rs`).

Files here are excluded from the published JSR package (`publish.exclude` in
`deno.jsonc`) — they are not part of the library's export graph.
