---
id: data-codec-004
title: Codec acceptance measures transport costs and verifies standalone streaming
spec_ref: ".agents/specifications/data-codec.spec.md#incremental-operation-spans-and-limits; .agents/specifications/data-codec/values.spec.md#identity-and-reconstruction; .agents/specifications/data-codec/values.spec.md#encoding-and-diagnostics"
---

# Measured and platform acceptance

## Requirement

Preconditions:

- Embedded grammars are produced unchanged by the previous published compiler.
- Measurements use optimized Rust builds and deterministic representative
  records.

Expected behavior:

- A reproducible report MUST compare codec, JSON arrays, and JSONL for ordinary
  records, Unicode/escaped text, nested records, and codec-native values.
- JSON-native comparisons MUST preserve equivalent ordinary values. Native
  comparisons MUST use an explicit lossless tagged JSON convention and MUST
  state that JSON parsing does not itself reconstruct native runtime values.
- Every fixture MUST verify its decoded value against the comparison value.
  Codec records MUST round-trip through native materialization and encoding.
- Raw and gzip byte sizes, gzip compression/decompression time, Rust encode and
  decode throughput for raw and gzip pipelines, sample count, record count, and
  input chunk size MUST be reportable via the in-tree measurement tooling
  (`test/perf/data-codec.report.ts`, driven by `examples/codec_probe.rs`).
  Compression-only cost and parser/pipeline cost MUST be identified separately.
  Data-document decode MUST NOT be advertised as fully materialized
  native-runtime throughput.
- Linux raw and gzip measurements MUST record independent child-process peak
  RSS, including startup and embedded grammars, and an initialized idle
  baseline. RSS is not live GC bytes, allocator counts, or an isolated memory
  delta. Streaming decode measurements MUST release each delivered document
  before reading the next.
- Measurements MUST report the host/toolchain and MUST NOT impose speculative
  speed or size thresholds or claim superiority from shared-host timings.
- Per-commit Checks MUST NOT re-run the full raw/gzip cost report. Persistent
  measured evidence MUST remain in-repo (for example
  `test/perf/data-codec-baseline.json`); regenerating the report is a manual /
  on-demand action, not a merge gate.
- A standalone streaming consumer MUST read arbitrary byte chunks, deliver
  complete records before EOF, retain native value types, honor backpressure,
  accept final unterminated records, and fail explicitly on malformed/truncated
  streams. Acceptance MUST run outside the checkout with an empty child PATH and
  no external grammar artifacts.
- Linux, macOS, and Windows, on x86_64 and aarch64, MUST build the `uffda`
  release CLI and run standalone CLI/codec streaming acceptance on native
  runners. That acceptance MUST be the Rust `standalone_acceptance` test run
  against those release binaries. It MUST NOT be a Deno script. Cross-builds
  alone MUST NOT count as execution evidence. Pending CI MUST remain distinct
  from verified platform results. Release Binaries MUST cover all six targets;
  per-commit Checks MUST cover the Linux targets and MAY omit the others.
- Product CLI subject options still decode exactly one record. The streaming
  consumer is an acceptance example of the public library API, not a new CLI
  command or multi-subject feature.

Postconditions:

- Corpus, report tooling, tests, standalone-acceptance CI coverage, and
  persistent measured evidence remain available.
- Codec artifact format stays unchanged. Release asset names follow the
  distribution requirements.
- Tests: `src/codec_runtime/data/tests.rs` (corpus determinism, median
  summarization, persistent baseline shape), `examples/codec_probe.rs`,
  `tests/standalone_acceptance.rs`, and `tests/build.rs`.
