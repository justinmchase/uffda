# Rust Uffda runtime migration

This crate is the side-by-side Rust runtime and CLI described in the
[migration plan](../docs/rust-migration.md). The six in-scope commands
(`compile`, `parse`, `exec`, `match`, `run`, `fmt`) are implemented. Production
cutover still ships Deno `uffda` via the installer; release previews attach as
`uffdar-*`.

## Running the CLI

From the repository root with a normal Rust toolchain on `PATH`:

```sh
cargo run --manifest-path rust/Cargo.toml --bin uffda -- --help
printf '%s' '{"kind":"number","value":42}' | \
  cargo run --manifest-path rust/Cargo.toml --bin uffda -- exec --ast
printf '%s' '{"kind":"any"}' | \
  cargo run --manifest-path rust/Cargo.toml --bin uffda -- match --ast --input 'hello'
```

Build a standalone executable with:

```sh
cargo build --manifest-path rust/Cargo.toml --release --bin uffda
printf '%s' '{"kind":"value","value":"hello"}' | \
  ./rust/target/release/uffda exec --ast
```

Standalone codec streaming and all-six-command acceptance are documented in
[the codec measurement report](../test/perf/README.md#rust-data-codec-acceptance).
`examples/codec_probe.rs` is a public-library acceptance consumer, not a new
product CLI command. It reads arbitrary byte chunks, emits records before EOF,
round-trips native values through a collected arena, and surfaces malformed
input or output failures. Benchmark-only gzip support is a dev dependency; it
does not change runtime, CLI, or compiled-artifact formats.

Checks and preview release builds target native Linux, Windows, and macOS on
x86_64 and aarch64, using one unchanged published-compiler language artifact
tree. Preview assets remain named `uffdar`; the installer and production `uffda`
cutover are unchanged until an explicit switch.

AST input comes from a file or standard input, not `-e` (matching the existing
CLI's AST-input restriction). Default exec/match/run output is the approved data
codec: arrays are whitespace-separated, object keys are quoted, top-level
strings are quoted, and undefined/native values retain their codec
representation. `--json` explicitly selects JSON compatibility output.
Usage/execution failures use exit code 2; invalid project configuration uses
exit code 3. JSON output runs the runtime's serializer, including native and
authored `toJSON` hooks through the same scheduler. Pending work belongs to
execution state, not a Promise language value; Rust deliberately does not
reproduce JavaScript's empty-object serialization of pending hooks.

Runtime values, symbol descriptions, property keys, authored string segments and
typed AST literals use `RuntimeString`, preserving every UTF-16 code unit.
`json::from_str` is the lossless JSON/AST entry point; `json::JsonValue`
preserves nested string values and keys before typed deserialization. Importing
an existing `serde_json::Value` only imports the scalar data it already
contains—it cannot recover lone surrogates rejected by an earlier decoder.

Length, indexing and slicing use UTF-16 offsets; iteration and pattern input
normalization use paired code-point items. JSON output escapes isolated
surrogates, including object keys and `toJSON` arguments. Scalar UTF-8 output,
Uffda source display, formatter output and hashing explicitly reject isolated
units. Root provenance retains the specified code-point positions; slicing a
surrogate pair retains its character span, and a pair formed across concatenated
segments covers both contributing spans. The shared string corpus lives in
`test/rust/string-fixtures.json`.

`ExpressionExecution::step_status` distinguishes completed work, cooperative
yielding and suspension. Explicit host callable values suspend ordinary calls
with rooted arguments. `Evaluation::drive` polls host futures outside collector
mutation scopes; completion returns a retained value or safely materializes a
new value in the originating arena. No executor dependency or Promise language
value is required. Pattern-owned expressions, iterable drains, parameter
patterns and rule execution forward requests to the same owning continuations.
`Runtime::drive` uses the shared host driver. `Runtime::pattern_from_source` and
`Runtime::from_source` accept an explicitly identified asynchronous producer.
`drive_external` distinguishes input delivery from host calls and polls both
outside collector scopes. Each input completion supplies one arbitrary runtime
value or explicit EOF; delivery is demand-driven, with no read-ahead. Cached
prefixes preserve backtracking and memo identity. Errors and cancellation are
explicit. Prefix snapshots structurally share immutable storage: append and
indexed lookup take logarithmic work without copying prior items. Fixed input
still uses its original vector storage. `PatternInput::stream` and
`PatternRequest::stream` now use `InputBuffer`; host-supplied fixed vectors
convert with `.into()`. Memo eviction is proof-driven: completed entries before
the live low-water mark are compacted without discarding active growth or its
dependencies. Incomparable nested/computed domains are retained conservatively.
All transient memos are released when parsing completes, while delivered match
graphs remain rooted. Live sources retain delivered items, and retained
historical snapshots keep their shared branches alive; there is no universal
constant-memory guarantee for retained input or unresolved backtracking.

`Runtime::reparse_edit` accepts a completed fixed-input parse, the complete
post-edit input, and outer-stream `at`/`removed`/`inserted` item counts. Reuse
requires unchanged descendant observations, including lookahead and rejected
attempts, not just an unchanged consumed span. Identical JSON prefix arrays and
objects permit reuse of enclosing rules with nested inputs. Reused graphs are
remapped to the fresh input domain without mutating prior matches. Recovery and
unproven downstream/computed domains are conservatively re-evaluated. Invalid
edit ranges, lengths, and overflowing counts leave the prior parse usable.

Source `parse`, `exec`, `match`, `run`, and file/glob `compile` execute the
existing embedded languages and compiler. Source/AST executable acceptance and
expanded formatter/recovery tests pass. Source grammars receive a scalar source
string, while text subjects remain iterable streams.

`fmt` now supports stdin, files/globs/default discovery, JSON results, and
`--check` without writes. It reads language and formatter metadata through the
rule runtime, including project declarations loaded through normal artifact
resolution. Built-in formatter, stdin/check, exclusion/idempotence, and
project-language ownership and custom nonexported formatter tests pass.
Recovered parses emit their AST plus complete ordered diagnostics/nonzero;
compile/format do not write recovered input. Module and standalone pattern
recoveries emit values plus diagnostics/nonzero.

```sh
cargo run --manifest-path rust/Cargo.toml -- exec -e '(add 20 22)'
./rust/target/release/uffda exec -e '[1 2]'
# [1 2]
./rust/target/release/uffda exec -e '{ a: [1 2] }'
# {["a"]: [1 2]}
printf 'export Main;rule Main=any;' |
  cargo run --manifest-path rust/Cargo.toml -- fmt -
```

Implicit interpolation/formatting accepts scalars only: arrays, objects and
callables have no universal text conversion. Use authored patterns/expressions
to choose a domain representation, or explicitly request `(json v)`. JSON
serialization of callable values is an error; function implementation source is
never a representation.

Default codec output does not invoke conversion hooks. Cycles, aliases,
callables, symbol keys and unsupported values fail explicitly rather than
silently losing information.

CLI compatibility is verified by a persistent reference matrix: 2,142 argument
cases and 210 process executions across all six supported commands. It covers
ordered validation conflicts, repeated flags, mode selection, source/AST
transports, subjects, configurations, contextual help, failures, generated
artifacts, and formatting writes/checks. Both runtimes verify the same
snapshots. Native diagnostic prose is intentionally not byte-matched; structured
error fields and nonempty messages remain checked. Preview help omits deferred
MCP/LSP, and default codec strings intentionally differ from reference text
display.

Regenerate the reference snapshots only when deliberately updating acceptance:

```sh
deno run --allow-read --allow-write \
  --allow-env=XDG_RUNTIME_DIR,HOME,XDG_CACHE_HOME,LOCALAPPDATA \
  test/rust/cli-compatibility-matrix.ts
```

This preview must not be treated as full runtime parity. Unicode lone-surrogate
values, remaining async/performance acceptance and release-platform validation
remain migration gates.

## Native data codec API

The Rust library exposes the approved authored data grammar through
`codec::data::DataDecoder`. `push_some` consumes through at most one record
boundary and returns both the consumed byte count and an owned data document;
call `finish` to deliver a final record without a trailing newline. A document
can be materialized inside a `uffda_heap::Mutation` as native runtime values or
encoded compactly/prettily. BigInt, Date and Error are collector-backed runtime
values; codec export rejects unsupported values, aliases, cycles and
symbol-keyed objects instead of silently losing information.

The CLI also accepts `--input-data` and `--input-data-file` for match/run and
uses codec records as its default execution output. `exec --json` still uses
JSON semantics: BigInt serialization fails, Date serializes as its UTC RFC3339
instant, and an Error with no enumerable user fields serializes as `{}`. Use the
data codec for lossless native-value round trips.

## Development

Install a stable Rust toolchain and the platform's native linker, then run:

```sh
cargo fmt --manifest-path rust/Cargo.toml --check
cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path rust/Cargo.toml
```

The build embeds the unmodified compiled language artifacts already present in
`bin/ast/src/lang/`. If that tree is missing, bootstrap it from the repository
root with the previous published `uffda` binary:

```sh
uffda compile 'src/lang/**/*.uff'
```

This is the published compiler, not the Rust preview. The Cargo build only reads
the artifacts and generates an include table in Cargo's build output; it never
parses source, re-lowers declarations, or rewrites artifacts. Embedded graph
linking and real expression/pattern/Uffda parsing, compiler lowering, and
metadata-selected formatting have separate tests.

Rust unit tests are co-located with their implementations. Collector integration
tests are in `src/gc_tests.rs` and cite requirements using `req:` comments. The
current specs auditor does not recognize Rust inline tests; verify these
citations separately rather than adding placeholder TypeScript tests to satisfy
its discovery rules.

## Collector evaluation

Runtime code uses the collector only through the `uffda-heap` crate
(`rust/heap`), which owns the `Gc`, `RefLock`, `Arena`, `Mutation`, dynamic
root, and `Collect` APIs and its own derive macro. Cargo features select the
implementation:

- `uffda-heap/gc-arena` (default): the `gc-arena` collector described below.
- `heap-leak`: a diagnostic backend that never frees. It isolates collector
  behavior when investigating memory faults and must not ship.
- The binary uses the system allocator by default. An optional `mimalloc`
  feature exists for experiments only; stress runs under WSL saw intermittent
  segfaults and wrong-result exits with mimalloc enabled and none with the
  system allocator.
- `PatternMatch` child lists use `MatchChildren` (empty / one / two inline, then
  `Vec`) so leaf and unary/recover wrappers do not allocate a child vector on
  every match.
- `ObjectProperties::set` parses array-index keys from UTF-16 without allocating
  UTF-8/`to_string` copies; ordinary identifier keys take the append fast path.
  `RuntimeString` keeps its scalar UTF-8 cache on `From<&str>`/`From<String>`
  and `to_utf8`/`sha256` reuse it.
- Environment binding names are `Rc<str>`, so variable captures reuse the
  compiled pattern's name instead of allocating a fresh `String` per match.
- `Languages` keeps a process-long GC session: module bindings stay warm across
  parse/compile calls while match trees are cleared after serialization.
  Multi-file `compile` prefetches source text and runs two warm worker heaps in
  parallel, merging units in plan order.

The default backend is `gc-arena` 0.7.0:

- Exact tracing and cycle detection, with derived trace implementations.
- Branded lifetimes prevent pointers escaping or crossing arenas.
- GC-aware mutable cells enforce write barriers.
- Dynamic roots let retained handles live outside mutation callbacks.
- Collection occurs outside mutation callbacks.

Unlike `Rc`, unreachable cycles can be reclaimed. Unlike an embedded JavaScript
engine, this does not introduce a second language runtime.

Its limitations matter: arenas are single-threaded, collection cannot run inside
a mutation callback, and async futures cannot directly retain branded pointers
across callback boundaries. The evaluator uses explicit execution frames and
roots pending values, allowing collection between frames. It services allocation
debt after each frame; a frame may still do work proportional to an aggregate's
size. Async invocation must retain suspended state before awaiting external
work. Testing that integration remains a gate, not an assumption.

Current coverage includes primitive equality, aggregate identity and sharing,
ordered object storage, captured lexical environments, external roots (including
a root held across a suspended future), cyclic reclamation, and repeated
allocation/collection. Closure tests include actual lambda execution, captured
callable reuse, 20,000-level invocation nesting, and reclaimable
object/closure/environment cycles. Rule, module-cache, memo, and real
async-invocation roots remain open.

## Expression execution

`Expression` decodes the current artifact discriminators for
number/boolean/value literals, reference/member access, array/object
initialization, interpolation, negation, invocation, and lambdas. `Evaluation`
flattens the syntax into immutable shared programs and runs resumable `step()`
calls; `finish()` returns an arena-isolated rooted result, and `read()` observes
it within the runtime.

Supported initialization includes array/string spreads, named/string-or-number
computed keys, and object/array spreads. Member support currently covers object
properties and array index/length access. Undefined remains distinct from a
missing binding; unresolved references and child errors propagate explicitly.
Errors remain failures on subsequent calls. Both execution and pending-tree
cleanup are tested at 20,000 nesting levels.

Shared fixtures in
[test/rust/expression-fixtures.json](../test/rust/expression-fixtures.json) run
in both implementations. Rust additionally forces collection after every frame.
Run the TypeScript differential fixtures and Rust citation audit with:

```sh
deno test --allow-read test/rust/
```

String interpolation and unary `not` now execute through the same frame stack.
Scalar text and number formatting remain supported. Object/array/callable text
conversion is intentionally rejected under the updated contract; `join` only
converts scalar elements. Explicit data JSON and asynchronous non-callable
JSON-hook behavior have differential tests. Lone-surrogate strings and remaining
non-JSON/async behaviors remain migration gaps. Deep strings, arrays, negation
and default Uffda output traversal are tested at 20,000 levels.

## Pattern and provenance execution

`PatternExecution` implements the artifact pattern kinds on the supported value
types, with iterator-protocol and rule integration still under validation. It
uses GC-rooted continuation frames and match trees, restores failed branches,
and validates repetition bounds and progress. Real lambda invocation uses this
matcher before evaluating its body in the captured lexical environment. `_`
resolves the current match value; repeated calls do not leak parameter bindings
into their callers. Failures unwind invocation context as well as temporary
values.

Values carry immutable span-only provenance wrappers. Equality and coercion
observe raw values; bindings, arguments, members, spreads, and nested streams
carry wrappers. Strings retain Unicode character provenance through compact
runs. Retaining a value does not retain its producing match tree. `read()`
observes a rooted result's raw outer value; `read_with_provenance()` allows
tooling to inspect its wrapper. Neither API reduces undefined or callables to
JSON.

This is not full runtime parity. The 36 native globals, declared/imported funcs,
symbols, maps/sets, iterator factories, and canonical declaration subjects now
have implementations and targeted tests. Rule execution, metadata, memoization,
left recursion, recovery, full provenance, async integration, and remaining
member/coercion behavior still require their enclosing acceptance gates.
Unsupported forms fail explicitly rather than silently producing a value. The
migration plan records the resolved `and` requirement discrepancy and TypeScript
`max: 0` correction.

## Module loading foundation

Both runtimes now target `.uff` and `.json` modules. Arbitrary `.ts`/`.js`
declaration-file loading is retired in both; controlled host injection is not
file loading. Rust has a filesystem declaration loader with URL-keyed identity,
direct JSON validation, structured read/parse errors, and `.uff` artifact
remapping under an explicit absolute layout. It never reads `.uff` source or
re-lowers imported artifacts. The shared module corpus covers outer declaration
shape validation. The resolver now also links module graphs and supports JSR
packages, blocking HTTP data transport, checksum-validated caches, lockfiles,
import maps, reexports, and cycles. Its 32 targeted tests pass, including the
shared semver and graph corpora. Runtime execution of these graphs remains a
separate acceptance gate.
