# `test/`

Preserved compatibility fixtures and optional Rust performance reports.

- `test/rust/` — checked-in JSON compatibility snapshots consumed directly by
  Rust option, process, language, and runtime tests. These remain regression
  inputs after retirement of the Deno runtime. Do not regenerate expected
  outcomes from the implementation under test.
- `test/perf/` — on-demand data-codec measurement tooling and recorded
  baselines; see `test/perf/README.md`. Its Deno orchestration runs the Rust CLI
  and codec probe, not a TypeScript runtime.

Reference-only Deno benchmarks and snapshot generators have been removed.
Runtime, incremental parsing, memo retention, and GC acceptance live in Rust.

End-to-end correctness that used to live under `test/integration/` is covered by
Rust lib tests (for example Morse in `src/lang_tests/uffda.rs` and format
round-trips in `src/format.rs`).

Files here are excluded from the published JSR package (`publish.include` in
`deno.jsonc`) — they are not part of the library's export graph.
