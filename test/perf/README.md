# `test/perf/`

On-demand Rust data-codec measurements and retained baseline evidence. Deno
orchestrates native Rust binaries; it does not provide a runtime implementation.
The former Deno Morse-parser report and reference-runtime micro-benchmarks are
retired. These reports are separate from Rust correctness tests.

## Rust data codec acceptance

`data-codec.report.ts` compares the native codec decoder with Rust `serde_json`
JSON arrays and JSONL, both raw and gzip. Its deterministic corpus covers sensor
records, Unicode/escaped strings, nested containers, and native data. Native
JSON uses explicit `$type`/`value` envelopes: it is a lossless comparison
convention, not ordinary JSON's native reconstruction. Every fixture is checked
against the codec document and round-tripped through a collected native arena.

This report is **on-demand / local**, not a per-commit Checks step. Checks still
run `codec_probe` tests and relocated standalone acceptance; measured evidence
is retained in `data-codec-baseline.json` rather than regenerated on every PR.

After the normal published-compiler bootstrap, run:

```sh
cargo build --locked --manifest-path rust/Cargo.toml --features embed-languages --release --bin uffda --example codec_probe
deno run --allow-read --allow-write --allow-run --allow-env=SystemRoot \
  test/perf/data-codec.report.ts
```

Optional positional arguments are the probe binary, CLI binary, and output JSON
path (default `.tmp/data-codec-report.json`). Linux GNU `/usr/bin/time` and
`rustc` on PATH are required for measurements. The standalone acceptance itself
is portable:

```sh
UFFDA_ACCEPT_CLI=rust/target/release/uffda \
UFFDA_ACCEPT_PROBE=rust/target/release/examples/codec_probe \
  cargo test --locked --manifest-path rust/Cargo.toml --features embed-languages --test standalone_acceptance -- --ignored
```

Checks and Release Binaries run that Rust test against their optimized binaries.
No Deno runtime, tools on PATH, source checkout, or external grammar tree is
available to the relocated Rust child processes. The CLI still accepts **one**
codec subject; multi-record stdin belongs to the public-library acceptance
example, not a new CLI command.

### Measurement boundaries

- Three independent subprocess samples per
  workload/transport/pipeline/operation. Each has an untimed warm pass, at least
  256 measured records, and at least 100 ms of timed work. Actual repetition
  counts and byte totals are retained.
- Decode measures native parsing to `DataDocument` versus `serde_json::Value`;
  encode uses prepared documents/values. Arena materialization and GC
  correctness are verified separately, not included in parser throughput.
- Raw/gzip parser pipelines use `flate2`'s Rust backend and default compression,
  including compression finalization or decompression in timed work. Transport
  size and separate gzip-only timing use Deno Web compression defaults. The two
  implementations may emit different compressed byte counts; Rust sample byte
  totals are also retained. All compression is benchmark-only.
- GNU time peak RSS covers the entire child, including fixtures, embedded
  grammars, startup, preparation and warmup. An initialized idle baseline is
  provided, **not** subtracted as an isolated heap/GC delta.
- Codec/JSONL release each decoded record; JSON arrays retain the whole array
  for one pass. Caller-owned resident corpora remain in memory. Separate
  32-versus-4,096-record duration probes feed one continuous codec/JSONL stream
  until EOF (gzip uses concatenated corpus members), while JSON processes
  32-record array batches. They do not prove constant memory for larger records,
  a larger single JSON array, or retained consumer output.
- These are informational shared-host measurements, not speed/size thresholds.
  Native JSON envelope parsing does not perform codec-native reconstruction.

### Provisional Linux baseline

[data-codec-baseline.json](./data-codec-baseline.json) retains the full host,
methodology, 216 parser/RSS samples, 12 raw/gzip size comparisons, and 24
batched duration/RSS probes. This earlier completed report predates the
continuous-stream probe; it is retained as provisional evidence, not a claim
that extended acceptance has passed. It used the former authored-grammar
decoding path, not the new grammar-independent native decoder; its throughput
numbers do not measure the codec artifact cutover. Medians from this run:

| Workload      | Codec / JSONL raw bytes | Codec / JSONL gzip bytes | Codec / JSONL raw decode records/s |
| ------------- | ----------------------: | -----------------------: | ---------------------------------: |
| Ordinary      |           2,148 / 2,468 |                427 / 440 |                    421 / 2,502,075 |
| Unicode text  |           2,358 / 2,358 |                197 / 197 |                    539 / 6,704,939 |
| Nested        |           4,054 / 4,694 |                223 / 234 |                    300 / 1,360,100 |
| Native tagged |          8,354 / 18,018 |                494 / 640 |                      231 / 308,254 |

This records a **large decode-performance gap**, not performance parity. Codec
raw decode peak RSS medians are about 8.8–11.5 MiB, compared with about 3.9–4.3
MiB for JSONL. Gzip codec decode has comparable rates and about 9.1–11.7 MiB
peak RSS. Earlier duration probes reset between corpus batches, so they do not
establish continuous-stream memory retention. The improved probe is covered by
Rust tests; a complete replacement measurement run remains blocked below.

**Reliability blocker:** extended optimized raw JSON reader probes
intermittently fail parsing or abort with `munmap_chunk(): invalid pointer`. An
independent crate depending only on `serde_json` reproduces the issue without
Uffda or `gc-arena`; the existing 1.0.151 and latest 1.0.154 both failed on this
host's Rust 1.99.0 toolchain. Debug reader and optimized slice-parser probes
passed. This narrows the investigation, but does not identify the root cause,
justify changing dependencies, or prove a fix. The report fails explicitly on a
failed subprocess; no successful-only retry/fallback is implemented.

### Reliability investigation (2026-10-24)

The current native-codec report still fails locally: optimized Unicode JSON
array decoding reported `expected ',' or ']'`. A small independent `serde_json`
1.0.151 probe also failed on installed Rust 1.94.0 and 1.96.0, not just 1.99.0.
Both reader and slice decoding failed, including a decoded-value mismatch,
aborts and segmentation faults. Earlier passing slice samples did not establish
that path as safe.

More importantly, [std-churn.rs](./std-churn.rs) reproduces corruption using
**only the Rust standard library**, compiled directly with `rustc`: no Cargo,
JSON, Uffda, collector, custom allocator or unsafe application code. It copies
32 fixed Unicode strings character-by-character, compares every copy and drops
the allocations. On this WSL2 / Core i9-14900K host, the same optimized binary
passed an initial 60-second run, then failed on five of eight separately pinned
virtual CPUs during 20-second samples: a string mismatch, allocator aborts and
segmentation faults. Passing samples must not be used to discard those failures.
Virtual CPU affinity does not identify a faulty physical core.

```sh
rustc --edition=2021 --test test/perf/std-churn.rs -o .tmp/std-churn-tests
.tmp/std-churn-tests
rustc --edition=2021 -O test/perf/std-churn.rs -o .tmp/std-churn
.tmp/std-churn 60
```

This rules out attributing all observed corruption specifically to Uffda or its
JSON reader. It does **not** distinguish hardware, host/virtualization,
allocator/standard-library or compiler faults. Do not change parser paths or
dependencies to hide it. The
[Reliability control workflow](../../.github/workflows/reliability.yml) runs the
dependency-free control on independent Linux, Windows and macOS runners,
including older Linux Rust toolchains, and regenerates the complete codec report
on an independent Linux host. Cross-host results remain pending until that
workflow completes. Local benchmark evidence remains untrusted.

Linux x86_64 standalone acceptance passed locally. Native Linux aarch64, Windows
x86_64/aarch64, and macOS x86_64/aarch64 are wired in Checks and release builds
but remain **pending CI execution**, not verified by the Linux report.
