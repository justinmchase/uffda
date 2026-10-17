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
  **Scope**: this only parses the `.uff` grammar source text itself
  (`uffdaGrammar(source)`) — it never compiles+runs the grammar against any
  example input (no Moby Dick or other roundtrip). A multi-second number here
  reflects self-hosted-parser overhead on a tiny file, not input throughput; the
  report's own output states this scope explicitly to avoid that confusion.

## Output behavior

- **Locally**: terse by default — a single line, unless the full compile falls
  outside the report's generous expected-time bound, in which case the full
  size/time breakdown prints automatically. Pass `--verbose` to always see the
  full breakdown.
- **In CI** (`GITHUB_STEP_SUMMARY` set): the full size/time table is attached to
  the job summary when the report is run. Checks no longer runs this report.

## Rust data codec acceptance

`data-codec.report.ts` compares the actual authored codec with Rust `serde_json`
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
cargo build --locked --manifest-path rust/Cargo.toml --release --bin uffda --example codec_probe
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
  cargo test --locked --manifest-path rust/Cargo.toml --test standalone_acceptance -- --ignored
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
- Decode measures authored grammar to `DataDocument` versus `serde_json::Value`;
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
that extended acceptance has passed. Medians from this run:

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

Linux x86_64 standalone acceptance passed locally. Native Linux aarch64, Windows
x86_64/aarch64, and macOS x86_64/aarch64 are wired in Checks and release builds
but remain **pending CI execution**, not verified by the Linux report.
