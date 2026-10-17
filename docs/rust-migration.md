# Rust Uffda migration

Tracking issue: [#277](https://github.com/justinmchase/uffda/issues/277).

## Goal and agreed scope

Implement a Rust Uffda runtime and standalone CLI, not a new Deno runtime.
Preserve the language and command contracts without new language features.

Approved scope extension (2026-10-10): design and implement **Uffda data codec
v1**, a small built-in textual data format with native-type round trips and
streaming records. This deliberately extends the original no-new-features scope;
its syntax and supported value contracts are specified below. Codec v1 also
changes default runtime value output from `exec`, `match`, and `run` to codec
syntax; `--json` retains the existing JSON compatibility output. Compiled
declaration JSON artifacts and their bootstrap remain unchanged for codec v1.
The user approved evaluating codec-form compiled artifacts as a separate
follow-on migration.

Build alongside the TypeScript implementation. Keep it available as a
differential-test reference until Rust passes the compatibility gates. Do not
switch release production early.

In scope:

- `compile`, `parse`, `exec`, `match`, `run`, and `fmt`, including custom
  language formatters and `--check`.
- All patterns, expressions, native globals, lexical scopes, recursion,
  memoization, incremental parsing, recovery, diagnostics, metadata, and
  provenance.
- Existing project files, lockfiles, compiled artifacts, package resolution, and
  all six current release platforms.
- Existing authored `.uff` grammars as the language definitions.
- Uffda data codec v1, including compact/pretty text, incremental record
  streams, native-value encoding/decoding, and explicit CLI/API integration.
  `match` and `run` will accept codec-decoded subject values explicitly as a
  native-value hot path, distinct from text input that is parsed by the selected
  pattern or rule.

MCP and LSP are required before production cutover (milestone 10): the installed
Rust `uffda` MUST serve `uffda mcp` and `uffda lsp` before replacing Deno for
editor and agent integrations. They were not part of the initial six-command
runtime/CLI parity milestones. Binary codec encoding, compiled-artifact format
replacement during codec v1, executable constructors, arbitrary class
reconstruction and function-source serialization are not part of codec v1.

Both runtimes support logical `.uff` modules and direct `.json` declarations,
including package exports resolving to either extension. `.uff` retains artifact
remapping without re-lowering; `.json` loads its actual path as data. Explicit
CLI AST input through `--ast` stays supported. Arbitrary `.ts`/`.js` declaration
file imports are retired in both runtimes; explicitly supplied host APIs remain
permitted. Rust additionally retires JS-native expression escape hatches.

All native globals will be implemented in Rust. Arbitrary JavaScript execution
is not required. Existing observable value semantics still need explicit
compatibility tests.

Approved Rust async contract (2026-10-10): asynchronous work is normalized
execution state, not first-class Promise values. Use rooted continuation frames
and explicit host suspension/resumption; host futures run outside collector
mutation/borrow scopes. Native and authored hooks consume completed invocation
results through the same scheduler. Do not reproduce JavaScript's `{}` Promise
serialization or authored-callable iterator-factory accidents. The TypeScript
host remains a reference with explicit, tested platform differences at these
boundaries.

Reference performance baseline captured on the current shared Linux host:
20,000-letter full parse averaged 41.0 ms, full reparse after a near-end edit
33.3 ms, incremental reparse 39.5 ms, and memo rehydration alone 10.5 ms. These
are observations, not thresholds or a demonstrated incremental speedup. The
existing memo-eviction report inserted zero memos for all its workloads under
selective memoization, so it does not establish an eviction memory bound. Rust
comparison and workloads that actually exercise memo retention remain required.

## Authority and references

Specifications and requirements remain authoritative. Use tests and the current
implementation as evidence, not as permission to override specifications.

Resolve gaps or contradictions explicitly, including the pending
[standard-library specification](../.agents/specifications/standard-library.spec.md).
The [module specification](../.agents/specifications/modules.spec.md) and
[bootstrap specification](../.agents/specifications/languages/compiler-bootstrap.spec.md)
are now aligned: imports load compiled declarations without re-lowering.

Use [verse-lang](https://github.com/justinmchase/verse-lang) as a Rust pattern
matching reference, not as the compatibility baseline. Reference counting alone
does not solve cyclic ownership involving closures and environments.

## Milestones and gates

### 1. Compatibility baseline

- [x] Trace implemented Rust tests to requirement documents and shared fixtures
      with the Rust citation audit and differential corpus.
- [x] Inventory commands, flags, outputs, exit codes, and failure behavior in
      the CLI acceptance inventory below.
- [x] Inventory the pattern, expression, global, module, and command surface;
      remaining parity gaps are listed below.
- [x] Record the current expression/pattern discriminators and all 36 default
      global names, separating implemented subsets from unresolved contracts.
- [x] Resolve known asynchronous and value-model differences. The approved Rust
      contract uses explicit suspension/resumption rather than Promise values,
      and the Promise-shaped authored `json` hook difference is documented as an
      intentional platform divergence. No general unhandled-rejection or
      arbitrary JavaScript prototype-fidelity requirement was found.
- [x] Define the standard-library surface in a specification: document each
      global's purpose, signature, value/coercion behavior, errors and purity;
      retain the small existing library without feature expansion.
- [x] Broaden the shared behavior corpus to at least two cases per global,
      including edge/error paths, and enforce the coverage threshold.
- [x] Specify and verify a cross-runtime identity/provenance slice for global
      values: strict aggregate identity, null versus undefined, NaN and signed
      zero, `id`, `coalesce`, registered symbols, and array/string `slice`
      provenance.
- [x] Add normative acceptance criteria for edge cases across all 36 globals;
      exercise byte/date/error/symbol natives, unsupported-input failures,
      undefined slots, value identity, and provenance directly in both runtimes
      rather than treating JSON serialization as the comparison.
- [x] Align module specifications and requirements with the revised `.uff` +
      `.json` boundary in both runtimes and no-re-lowering bootstrap contract.
- [x] Verify removal of TS/JS file importers, JSON declaration validation,
      injected host integrations, package JSON loading, and Rust data loading.
- [x] Build shared Rust/TypeScript differential fixture runners for the
      implemented expression, pattern, global, and resolver behavior.
- [x] Extend differential coverage across the declared global contract matrix,
      including identity, undefined, native values, errors, and provenance,
      without reducing those observations to JSON.

Gate: compatibility inventories and known platform differences are recorded;
every global has normative edge-case acceptance and at least two shared portable
behavior cases. Direct tests cover runtime identity, undefined, native values,
failures, and provenance without serializing away those properties. Remaining
behavior that is intentionally platform-specific is documented in its governing
specification and fixtures.

### 2. Dynamic values and memory management

- [x] Record a comparative fit evaluation of maintained tracing collectors.
      Retain `gc-arena` 0.7 for its generative arena branding, exact tracing,
      cycle collection, and external roots suitable for suspended work.
      `gc`/`rust-gc` and `boa_gc` are credible maintained alternatives, but
      their documented APIs are a less direct fit for these combined needs. This
      is a design rationale, not a benchmark or proof alternatives cannot work.
      Tradeoffs: single-threaded operation, collection outside mutation
      callbacks, and explicit async-root handling.
- [x] Prototype `gc-arena` 0.7 with branded pointers, write barriers, external
      roots, and unreachable-cycle reclamation (inherited 38-test suite rerun).
- [x] Isolate the collector behind the `uffda-heap` crate so runtime code never
      names `gc-arena`. A never-freeing `heap-leak` backend and an optional
      `mimalloc` feature allow swapping either dependency without code changes.
- [x] Compare intermittent optimized-compile crashes across the gc-arena and
      never-freeing backends, each with mimalloc and the system allocator, under
      identical conditions. Failures clustered on mimalloc (segfaults, panics,
      wrong-result exits) with both heap backends and with `autoMemoryReclaim`
      on or off. System-allocator builds were clean (0 / 230). Default builds
      use the system allocator; `mimalloc` remains optional and experimental
      only.
- [x] Test primitives, collections, identity, ordering, and coercion through
      value, evaluator, and native-global tests.
- [x] Verify primitive strict equality, array/object identity, ordered
      replacement, JavaScript number formatting, truthiness, and basic string
      coercion.
- [x] Test closures and cycles across values, environments, scopes, and modules,
      including reclamation after external roots are released.
- [x] Verify captured environment graphs, suspended-future external roots, and
      actual async invocation through the rooted continuation driver.
- [x] Execute real lexical closures, preserve retained captures through GC, and
      reclaim an object/closure/environment cycle after releasing its roots.
- [x] Verify actual module callable/environment cycles survive collection
      between execution frames and are reclaimed when bindings/execution drop.
- [x] Test native callbacks, suspended evaluation, metadata, and provenance
      through evaluator, rule-runtime, and public host integration tests.
- [x] Test roots for active execution, memo dependencies, resolver/program
      caches, and retained matches.
- [x] Force collection between evaluation steps and verify reclamation of
      abandoned values, closures, environments, and module graphs.

Gate: semantic and cyclic-memory tests pass. Collector integration with actual
evaluation and suspension has been demonstrated. Full language parity remains a
separate open gate.

### 3. Execution foundation

- [x] Deserialize existing compiled artifacts and reject malformed declarations
      explicitly.
- [x] Decode the implemented expression subset with typed discriminators and
      explicit errors for unsupported forms.
- [x] Implement lexical environments and structurally shared immutable scopes.
- [x] Verify structurally shared lexical environment storage, shadowing
      including undefined, and iterative lookup through 10,000 parent layers.
- [x] Implement input normalization, nested and asynchronous streams, Unicode
      positions, provenance, match trees, errors, and execution frames.
- [x] Implement ordered awaitable execution and stack-safe rule scheduling,
      including explicit host suspension/resumption.

Gate: foundation tests pass, including deep nesting and scope isolation.

### 4. Expressions and globals

- [x] Implement all in-scope expression forms: literals, references, members,
      strings, arrays, objects, invocation, and lambdas. Native JavaScript AST
      escape hatches remain intentionally unsupported.
- [x] Verify literals, lexical references, object and array members,
      arrays/objects/spreads/computed keys, interpolation, and unary `not` in 23
      shared fixtures, including collection after every Rust frame.
- [x] Verify execution and pending-tree cleanup at 20,000 nesting levels.
- [x] Implement invocation, lambdas, declared funcs, argument binding, and
      errors through rooted evaluator/module continuations.
- [x] Execute lambdas through actual parameter-pattern matching, including
      invocation spreads, lexical captures, repeated calls, sticky errors, and
      restoration of caller context.
- [x] Implement all 36 current default globals in Rust and register them as
      first-class callable values.
- [x] Verify the 36-name native registry, first-class callable lookup, lazy
      callback iteration, symbol/map/set operations, and CLI-only `echo`; shared
      fixtures and rooted native-callback tests pass.
- [x] Preserve provenance for tested rearranged values and computed call
      origins; complete operation-by-operation parity remains in the
      differential-coverage gate.
- [x] Verify span-only immutable wrappers, raw equality, carried-wrapper
      identity, Unicode character runs, concatenation, nested-stream character
      origins, and lambda computation origins. Retained values do not retain
      match trees.
- [x] Verify supported async behavior for host calls, authored/native hooks,
      async input, wake/resume, collection, cancellation, and failures.
- [x] Remove first-class Promise compatibility artifacts; consume
      authored/native hook results uniformly through rooted execution
      continuations.
- [x] Provide explicit suspension/resumption and cooperative scheduling with
      executor-independent host futures; no GC mutation or borrowed state across
      await, and deterministic cancellation/error cleanup.
- [x] Recheck the expression evaluator against the current reference fixtures
      and requirements; no additional clearly specified expression-only gap was
      found (59 focused Rust tests and 31 shared expression fixtures pass).

Gate: implemented expression/global fixtures and memory stress tests pass. The
declared compatibility and global edge-case matrix is now covered under
milestone 1. Broader semantic parity beyond those declared contracts remains
tracked by the open runtime, incremental parsing, CLI, and platform gates.
Automatic Promise scheduling and broader prototype/non-JSON behavior remain
outside the agreed Rust async and value contracts.

### 5. Patterns and rules

- [x] Implement the full pattern inventory, including all current pattern kinds
      and rule-runtime integration.
- [x] Verify `any`, `ok`, `fail`, `end`, `equal`, `includes`, `then`, `or`,
      `variable`, `maybe`, `not`, `lookahead`, `skip`, `into`, `except`, `type`,
      and `quantifier` on the currently supported value/input types.
- [x] Verify failed-branch position/binding rollback, skip propagation,
      contextual equality, repetition bounds/progress, closed/open end attempts,
      and explicit pattern errors.
- [x] Verify 20,000 nested patterns and calls without host-stack recursion.
- [x] Verify `and`, `between`, Unicode `character`, ECMAScript `regexp`, object
      `over`/rest, `switch`, and rightmost-failure diagnostics.
- [x] Integrate `projection`, `pipeline`, `resolve` host requests, and `recover`
      with complete rule scheduling and stream identity.
- [x] Implement lexical rule visibility, parameterized rules, captured inline
      arguments, backtracking, and binding isolation.
- [x] Implement recursion, memoization, recovery, and diagnostics.
- [x] Implement and test conservative memo eviction and incremental edits for
      supported completed, fixed, flat inputs. The current tests cover eviction,
      retained results, reused-prefix invalidation, and value/ diagnostic parity
      with a fresh parse.
- [x] Validate incremental edits over uncertain prefixes, recovery, and
      nested/multiple input domains under the existing conservative contract.
      Proven-identical nested prefix items permit outer rule reuse; unproven
      computed domains and prior recovery activations are re-evaluated. Reuse
      checks descendant observations, not consumed spans alone, and remaps
      retained graph identities into the fresh input domain. Acceptance covers
      failed-match reuse, malformed/overflowing edits, lookahead, rejected
      alternatives, repeated edits, recovery parity, left-recursive edits, and
      220 edit/fresh-parse comparisons.
- [x] Verify reachability-based memo retention and compaction safety for pending
      growth, active dependencies, and incomparable input domains. Measure
      first-pass peaks and post-collection retention across repeated parses. As
      approved, input, retained match graphs, and live backtracking/growth
      windows may grow; this is not a universal constant-memory guarantee.
- [x] Preserve metadata and provenance through rule execution, recovery,
      diagnostics, and retained match results.

Gate: pattern, recursion, recovery, and diagnostics fixtures pass without host
stack overflow on deeply nested inputs. Incremental-edit and eviction acceptance
passes under the existing proof-driven, conservative contract. Edits are
described against a completed fixed outer stream; nested subjects are supported,
not a new nested-edit-path API. Unproven downstream affected regions are fully
re-evaluated rather than guessed.

Retention acceptance for `Main = Atom*`, `Atom = any`:

| Input items | Observed peak memos | Memos after completion | Live GC allocations after collection |
| ----------- | ------------------- | ---------------------- | ------------------------------------ |
| 64          | 65                  | 0                      | 390                                  |
| 256         | 257                 | 0                      | 1350                                 |
| 1024        | 1025                | 0                      | 5190                                 |

Each size is parsed three times with collection during execution and after
completion. Retained allocation counts remain identical across all three runs.
The pinned root explains the growing live memo window; retained input and
delivered graphs explain the remaining GC objects. These are collector-object
counts, not RSS or whole-process byte measurements. Broader performance/memory
comparisons remain a separate migration gate.

### 6. Self-hosted languages and modules

- [x] Execute existing compiled tokenizer, pattern, expression, compiler,
      formatter, and Uffda language modules.
- [x] Verify filesystem declaration identity/remapping, package export and
      integrity/cache/lockfile fixtures, and iterative module graph linking.
- [x] Compile module declarations into executable rule/func/decorator programs
      and integrate their shared lexical environments.
- [x] Implement `.uff`/`.json` local/package resolution, exports, identity,
      caching, integrity verification, and lockfiles.
- [x] Embed unmodified artifacts produced by the previous published compiler.
- [x] Embed a complete authored-language artifact tree without modifying
      artifacts, validate declaration data, and link embedded language graphs.
- [x] Compile the language sources for the next build using the previous
      published compiler bootstrap.

Imports only load compiled declarations. Never parse or compile on import,
commit compiler seeds under `src/`, or rewrite artifacts after compilation.

Gate: corpus parsing/compilation and published-compiler bootstrap have passed.
Keep rerunning this gate after changes to compiler or grammar sources.

### 7. CLI parity

- [x] Implement all six commands with their supported source, stdin, inline,
      file, and AST input modes.
- [x] Preserve discovery, paths/globs, machine output, diagnostics, and exits
      for the implemented command paths.
- [x] Preserve custom formatting and `--check`.
- [x] Test successful and failing invocations end to end, including standalone
      optimized-binary smoke tests with user runtime tools absent from `PATH`.
- [x] Run a relocated binary outside the checkout with no repository artifacts
      available and an empty `PATH`, exercising all six commands, source/AST
      execution, JSON output, match failure diagnostics, compile artifacts, and
      formatting/check. Generated compile artifacts are removed before the
      subsequent formatting command.
- [x] Compare 29 shared validation cases against the reference CLI, including
      exact diagnostic code, phase, message, exit code, and empty stdout. Reject
      `--config` for parse/match and align covered usage diagnostics.
- [x] Exercise supported option equivalence classes and ordered option
      interactions against the reference: 2,142 argument cases and 210
      executions across all six commands. Compare selected options, successful
      values, structured diagnostics, exit codes, generated artifacts, and
      formatting writes/checks. Include contextual help, parse-before-validation
      precedence, repeated flags, source/AST transports, subjects,
      configuration, and nested failure locations.

Gate: the persistent reference matrix and relocated-command tests pass. This is
a finite acceptance matrix, not a claim about every possible arbitrary argument
sequence. Both runtimes independently verify checked-in snapshots in
`test/rust/cli-compatibility-matrix.json`; the adjacent TypeScript generator
reproduces them. Native codec-subject options retain their stricter rejection of
repeated subject options.

Approved compatibility boundaries: native diagnostic prose and human-readable
output are not byte-for-byte contracts; structured fields and nonempty
explanations remain checked. Rust keeps the approved codec default output,
preview help now lists MCP/LSP (still expanding toward Deno parity), and
build-specific versions differ. Help/version precedence matches the reference
even when those tokens appear as option values. Environment cwd precedence and
parse/config/subject failure ordering are covered.

Reliability observation still requiring cutover investigation: one debug process
run panicked in a native `ExactSizeIterator` length assertion during module
execution. Subsequent matrix/full-suite reruns and 200 isolated repetitions did
not reproduce it. No cause or fix is claimed; this must not be silently treated
as production-readiness evidence.

### 8. Uffda data codec v1 (approved scope extension)

Dependency order:

```text
Lossless runtime string/value model
  -> Codec contract and streaming grammar
  -> Rust encoder/decoder and native-value materialization
  -> CLI/API integration and acceptance
```

Design the codec alongside milestone 2's value model; do not wait until cutover
to discover that strings or native identities cannot round-trip. Codec syntax is
data, not arbitrary Uffda expression execution. Authored patterns and
expressions remain the preferred mechanism for domain-specific conversions.

#### 8.1. Data model, syntax and authority

- [x] Write focused codec specifications and requirement-cited acceptance cases
      before implementation, following the repository's specs method.
- [x] Define exact supported types and round-trip guarantees, distinguishing
      value equality from identity preservation.
- [x] Define comma-free arrays and records; settle identifier grammar, token
      boundaries and separators explicitly rather than borrowing expression
      syntax implicitly.
- [x] Support bare identifier keys and quoted literal string keys with identical
      string-key semantics; quoted keys have no interpolation. Reject duplicate
      record keys.
- [x] Define lossless Unicode/string escaping, fractional and integral numbers,
      BigInt, negative zero, NaN and infinities.
- [x] Define explicit native tags for bytes, dates/instants, symbols and
      structured errors; decide map/set inclusion and exact tag spelling before
      implementation.
- [x] Specify date precision/timezone semantics, well-known/global/local symbol
      identity, error fields/causes and reconstruction without arbitrary
      exception classes. A symbol description alone must not be treated as
      identity.
- [x] Define explicit failures for unsupported values and unknown/invalid tags.
      Never omit values, invent placeholders, expose implementation source or
      silently stringify native values.
- [x] Keep v1 free of functions, executable constructors, arbitrary classes and
      cyclic graphs. Decide shared-reference/local-symbol handling explicitly;
      reject cases whose required identity cannot be preserved.
- [x] Make decoding a fixed, validated data operation, not callable lookup,
      imports or arbitrary expression evaluation.

Approved v1 syntax, now parsed by the authored data grammar and reconstructed by
the Rust owned-data boundary:

```uff
{
  name: "Ada"
  "display name": "Ada Lovelace"
  balance: 12345678901234567890n
  created: @date"2026-10-10T18:00:00Z"
  payload: @bytes"SGVsbG8"
  failure: @error{name:"Timeout" message:"Request timed out"}
}
```

Gate: every supported type has an unambiguous, validated representation and
specified reconstruction. No convention-dependent guessing or unsupported-type
success fallbacks.

#### 8.2. Streaming and comments in the same codec

Implemented foundation: the public Rust `codec::RecordDecoder` frames raw UTF-8
source records incrementally, preserving byte spans across arbitrary chunk
boundaries, comments and multiline containers. `push_some` supports consumer
backpressure; record/depth limits, cancellation/reset, poisoned error state and
offset-overflow diagnostics are covered by 11 passing integrated tests. This is
structural framing. `codec::data::DataDecoder` now composes it with the authored
grammar and owned native construction, stopping after one record per call.
Collector-backed materialization is available explicitly inside the caller's
arena mutation; CLI selection remains pending.

- [x] Define newline-framed top-level records within the same codec
      specification, not a second JSONL-like language.
- [x] Permit multiline containers; newlines inside containers are whitespace.
      Outside containers/strings, require a newline between top-level records;
      EOF may terminate the final complete record.
- [x] Define blank lines, `#` comment-only lines and trailing line comments.
      Comments do not erase record-boundary newlines; `#` inside strings is
      text.
- [x] Provide compact one-physical-line encoding and pretty multiline encoding
      of the same values. Escape string newlines in compact output.
- [x] Incrementally decode arbitrary byte chunks, including boundaries inside
      UTF-8 characters, escapes, tags and comments.
- [x] Emit one owned record per `push_some` call with caller-controlled
      backpressure; cancellation/reset discard decoder state. Materialization
      occurs explicitly inside the caller's collector mutation.
- [x] Define truncated-record/EOF behavior, record/source locations, explicit
      size/nesting limits and failure behavior. Do not silently resynchronize
      past malformed data.
- [x] Test mixed scalar/container records, empty streams, comments, final
      records without newline and malformed records.

Gate: chunking cannot change results or errors. Decoder memory scales with the
current record and bounded consumer backlog, not total stream size.

#### 8.3. Optional metadata decision

- [x] V1 has no metadata header. Unknown tags, including `@meta`, fail.
- [x] Do not add a `multi` flag: structural nesting already determines whether a
      newline terminates a record.
- [x] Decoding never enables imports, executable decoders or constructors.

Gate: a reader can interpret an unadorned stream, and any header cannot be
mistaken for application data or silently alter decoding capabilities.

#### 8.4. Authored grammar and Rust implementation

- [x] Author the data grammar in `.uff` with documented failures and corpus
      tests, preserving the published-compiler bootstrap rules.
- [x] Define a validated data AST/tag representation and materialize native
      values through a fixed codec boundary; keep genuinely native construction
      in Rust.
- [x] Implement compact/pretty encoders and incremental decoder with stack-safe
      traversal, deterministic output and explicit failures.
- [x] Verify GC/root safety across encoding, partial decoding, record delivery,
      suspension, cancellation and failure.
- [x] Test every supported type's round trip, escaping, malformed input, deep
      nesting, identity policies and native-type reconstruction.

Gate: the actual authored grammar and native runtime work together; generic JSON
fixtures or host-only prototype code are not sufficient acceptance.

#### 8.5. Integration and measured acceptance

- [x] Decide runtime value output policy: use codec encoding by default,
      including quoted/round-trippable top-level strings; preserve JSON output
      through `--json` for compatibility.
- [x] Replace the interim CLI Uffda value renderer with codec output, including
      top-level strings and undefined values; `--json` preserves JSON behavior.
- [x] Decide `match` and `run` subject contract: retain text input for subjects
      to be parsed by the selected grammar/rule, retain `--input-json`, and add
      explicit codec-data subject input for native values as a direct
      performance path. `--ast` remains the program AST input, not the subject.
- [x] Implement explicit `--input-data` and `--input-data-file` subject options
      for `match` and `run`, preserving mutually exclusive text, JSON,
      codec-data, and AST program input modes.
- [x] Expose explicit Rust library DataDecoder, materialize and compact/pretty
      encode APIs without treating them as CLI data modes.
- [x] Preserve scalar-only implicit interpolation and explicit existing JSON
      compatibility. Do not add universal `.toString` or automatic JSON
      fallback.
- [x] Update directly affected specs, requirements, README command
      documentation, and end-to-end tests with the CLI integration.
- [ ] Measure size, throughput and memory against JSON/JSONL, compressed and
      uncompressed, with representative ordinary and native-type records.
- [ ] Verify standalone Rust operation and streaming on supported platforms.

Gate: codec values and `match`/`run` data-subject CLI paths are implemented and
covered by focused tests. Preliminary raw/gzip codec-versus-JSON/JSONL
[measurements](../test/perf/README.md#rust-data-codec-acceptance) and
[persistent results](../test/perf/data-codec-baseline.json) cover four
representative corpora, 216 encode/decode/idle RSS samples, and 24 batched
duration/RSS probes. Native comparisons use explicit lossless JSON envelopes;
codec document decode is measured separately from native arena
materialization/GC correctness. The measurements expose a substantial codec
decode-speed gap (about 230–540 records/s on this host), rather than establish
performance parity or a new performance threshold.

The measurement gate remains open: extended optimized raw JSON reader stress
intermittently reports invalid input, aborts with
`munmap_chunk(): invalid
pointer`, or segfaults. An independent crate with only
`serde_json` reproduces the failure without Uffda or `gc-arena`; both 1.0.151
and 1.0.154 were exercised on this host's Rust 1.99.0 toolchain. Debug reader
and optimized slice-parser probes passed, but do not establish a fix or a root
cause. The original completed baseline is retained as provisional evidence. The
improved continuous-stream duration probe is tested, but a complete replacement
report is blocked by this reliability investigation. Do not bypass it by
silently changing parser paths, accepting only successful runs, or claiming the
earlier debug iterator panic is resolved.

Linux x86_64 relocated all-six-command and public-library streaming acceptance
passes with empty child PATH and no external artifacts, including byte chunks,
pre-EOF delivery, native materialization across collection, backpressure,
malformed trailing records and final unterminated records. Per-commit Checks run
native Linux x86_64/aarch64 acceptance only; release builds wire native Linux,
Windows and macOS x86_64/aarch64 acceptance. The supported-platform checkbox
stays open until the release jobs actually pass on every platform. Release
assets are named `uffda`. The six-platform build/verify path is wired in Release
Binaries; the supported-platform measurement checkbox stays open only for the
remaining codec size/throughput gate and the sporadic debug iterator panic
(cutover investigation, not a codec acceptance fix). Full repository validation
is required before pushing.

#### Deferred artifact adoption

Compiled declarations, bootstrap, package resolution, project/lock files and
structured diagnostics retain their current formats during codec v1. The user
approved a follow-on migration to encode compiled `ModuleDeclaration` artifacts
using Uffda data syntax and embed/load those artifacts directly from that
representation. This is intentionally not part of codec v1's current acceptance
gate; keep the existing JSON artifact/bootstrap path unchanged until the
follow-on has an explicit compatibility and rollout design.

Before adopting the new representation, verify that the codec preserves the
complete declaration data model and establish a bootstrap transition in which
the previous published compiler can produce the new artifact format before
`compile:lang` starts requiring it. Build and resolver consumers must load the
new representation directly. Do not post-process compiler output, re-lower on
import, or remove JSON compatibility before the published compiler and consumers
can transition safely. Evaluate JSR asset/entrypoint conventions, artifact
versioning, mixed-version compatibility, and rollback behavior. Binary encoding
of the same data model remains deferred.

### 9. Reusable Rust packages

Once the Rust API and command behavior stabilize, split the current
`publish = false` preview crate into a reusable Rust library and the product
CLI. The package should let a consumer replace their Uffda/Deno runtime while
keeping their own grammar, command name, CLI policy and host integration.

- [ ] Define the stable `uffda-runtime` library boundary: dynamic values and GC,
      expression/pattern/rule execution, native globals, async host suspension,
      lossless strings/provenance, resolver/project/package loading,
      diagnostics, formatter and codec APIs.
- [ ] Keep Uffda's authored grammar bundle, default language registry and
      product-specific CLI choices outside the generic runtime crate. Allow a
      host application to register its own compiled module declarations and host
      functions without forking runtime internals.
- [ ] Provide a reusable embedding/build component that validates a compiled
      artifact tree and generates a static Rust declaration registry from
      unmodified JSON artifacts. Consumers should be able to keep using their
      existing published compiler; no Rust build step may parse `.uff`, re-lower
      artifacts or require checked-in compiler seeds.
- [ ] Decide whether command parsing/dispatch belongs in a separate optional
      `uffda-cli` support crate or remains a documented reference frontend. Keep
      it configurable for a consumer's own command name, entry rules, language
      metadata and output policy.
- [ ] Add an example custom-language CLI that embeds consumer-owned compiled
      declarations, resolves project modules, runs a rule, formats source and
      demonstrates host API injection without depending on Deno at runtime.
- [ ] Define crate names, workspace/version policy, license and API stability;
      check registry-name availability and publish the stable library/build
      components to crates.io only after parity and package tests pass.
- [ ] Add downstream-consumer tests that build from the published crates and run
      without access to this repository's `src/lang`, `bin`, or build scripts.

Package gate: an independent project can compile its own grammar with its
existing compiler, embed the resulting declarations, and build a working
Rust-backed custom CLI using published crates and documented APIs.

### 10. Side-by-side release binaries and cutover

`compile-rust` publishes the Rust CLI as `uffda-${version}-${target}` with
`SHA256SUMS`. The Linux `install.sh` installs that `uffda` binary. There is no
separate `uffdar-*` release asset.

Rust targets the current Linux/Windows/macOS x86_64/aarch64 triples via a native
OS/arch GitHub Actions matrix (not one Ubuntu cross-compile host). Each runner
embeds the `compile-lang` AST tree, builds `uffda`, and runs outside-checkout
acceptance before attach.

- [x] Run unit, corpus, integration, differential, and GC-stress suites (ongoing
      Checks; release attach still requires a draft that stays unpublished until
      smoke finishes).
- [x] Compare performance and memory against the baseline (language compile now
      beats Deno on this host; broader benches remain optional).
- [x] Build and outside-checkout-verify Linux, Windows, and macOS on x86_64 and
      aarch64 in `release-binaries` (`compile-rust` matrix +
      `standalone_acceptance`).
- [x] Add a native Linux `uffda-*` release build using the bootstrapped AST
      artifact tree, with an outside-checkout smoke test and `SHA256SUMS`.
- [x] Extend the `uffda-*` build, attach, and verify path to the other supported
      release targets (six native runners). Linux `install.sh` installs `uffda`.
- [ ] Implement `mcp` and `lsp` on the Rust CLI with parity against the Deno
      reference (stdio transports, session/tools/diagnostics/completions as
      already specified under `.agents/` for those surfaces). The release
      `uffda` binary is already this Rust CLI.
- [ ] Preserve asset names, checksums, installers, and setup-action behavior
      through the eventual approved cutover (Rust becomes the installed
      `uffda`).
- [ ] Update implementation-specific specifications and contributor docs for the
      Deno→Rust production switch (including MCP/LSP command availability).
- [ ] Switch production only after package gates (milestone 9), MCP/LSP cutover
      gates, and an explicit cutover approval. Do not publish a draft until
      Release Binaries attach + smoke succeed — publishing early leaves an empty
      immutable release.

## Final acceptance

An installed Rust `uffda` runs every in-scope command without Deno installed,
preserves agreed contracts, safely handles dynamic values and closures, and
participates in the published-compiler bootstrap process. The approved codec v1
additionally passes its defined native-type round-trip, streaming, failure and
standalone integration gates. An independently built custom CLI can consume the
published Rust runtime and artifact-embedding component. Deferred
artifact/binary adoption is not required for this acceptance.

## Implementation progress

The checkpoint entries below are historical snapshots in chronological order;
their open items may have been completed by later entries. The milestone
checklists and remaining-runtime inventory above are the current status.

### Parallel milestone review rollup (2026-10-11)

| Milestone        | Latest evidence                                                                                                                                                                                                                                                                           | Remaining gate                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Compatibility | Normative acceptance matrix covers all 36 globals. Shared Rust/TypeScript corpus: 82 cases, at least two per global. Direct identity/undefined/native/error/provenance checks pass. Full Deno suite: 873 passed; Rust: 383 library, 1 artifact, 28 CLI, 5 codec CLI, 3 host tests passed. | None within the declared compatibility baseline; documented platform divergence remains explicit.                   |
| 2. Memory        | Comparative fit rationale recorded for `gc-arena` 0.7 versus `gc`/`rust-gc` and `boa_gc`; no benchmark claim.                                                                                                                                                                             | No implementation gate currently open.                                                                              |
| 3. Execution     | 25 focused Rust tests passed across artifacts, scopes, streams, diagnostics, host suspension, and deep scheduling.                                                                                                                                                                        | No implementation gate currently open.                                                                              |
| 4. Expressions   | 59 focused evaluator tests and 31 shared expression fixtures passed; no additional clearly specified expression-only gap found.                                                                                                                                                           | None within milestone 1; broader runtime parity remains governed by the remaining runtime gates.                    |
| 5. Patterns      | Observation-safe incremental reuse, fresh-domain graph remapping, nested/recovery/left-recursion acceptance, and 220 edit comparisons pass. Retention peaks and stable post-collection counts measured at 64/256/1024 items. Rust all-target validation passes.                           | None under the approved conservative reachability contract; general performance/memory comparisons remain separate. |
| 6. Modules       | 45 focused Rust tests and 39 Deno bootstrap tests passed; 70 compiled grammars had zero structural differences and no bin artifact changes.                                                                                                                                               | No implementation gate currently open.                                                                              |
| 7. CLI           | Rust CLI integration tests: 28 passed, including parse path/stdin, compile fallback, explicit valid config, relocated-binary operation without checkout artifacts, and output-write failure exit 70.                                                                                      | Exhaustive flag combinations and internal execution-exception handling remain uncovered.                            |
| 8. Codec         | Rust all-target validation: 383 library, 1 artifact, 28 CLI, 5 codec CLI, and 3 host tests passed; strict Clippy, Rust formatting, Deno formatting/lint, and full Deno tests passed. README/specs/requirements updated.                                                                   | Size/throughput/memory measurements and Windows/macOS streaming/build validation remain open.                       |

The Rust counts above are from one all-target Cargo run against the consolidated
worktree. The full Deno suite passed with its temp directory outside the
checkout; this avoided temporary projects discovering the repository's ancestor
`uffda.jsonc`. Repository-wide `deno fmt --check`, `deno lint`, and
`git diff --check` also pass.

### Continuation baseline (2026-10-10)

The inherited Rust baseline was rerun successfully: 38 unit tests, no failures.
All staged and unstaged work is preserved; work continues directly in this
folder. Granular checks above record evidence, not completion of their enclosing
milestones. No CLI or pattern-runtime parity is claimed.

Known external/design gates:

- Rust and the native linker are now installed normally. Use the normal
  rustup/PATH setup; no repository-local toolchain or linker fallback is
  permitted.
- The continuation checkpoint's pending standard-library contract was
  subsequently resolved: see the current standard-library specification and the
  completed milestone 1 edge-case requirement. The library remains limited to
  its existing 36 globals.
- The stale `and`
  [requirement](../.agents/requirements/patterns-runtime/and-001-core.requirement.md)
  was aligned with the higher-authority
  [specification](../.agents/specifications/patterns/runtime/and.spec.md) and
  existing reference behavior: children start at P, success forwards the final
  child's consumed position/value/skip status, and failure rolls back. Rust
  implementation validation is in progress.
- The
  [quantifier specification](../.agents/specifications/patterns/runtime/quantifier.spec.md)
  says maximum zero permits zero repetitions. The TypeScript off-by-one was
  corrected: zero stops before child evaluation after bound validation.
  Regression tests verify empty output, unchanged position, and no child matches
  even for a child that would fail or raise an unknown-reference error. The
  targeted TypeScript suite passes (4 tests, 21 steps).
- Production cutover, release publication, tags, pushes, and commits are not
  authorized. Final cutover stays open pending parity and explicit
  authorization.

The side-by-side crate lives in [rust/](../rust/). The initial increment
exercises the `gc-arena` collector with primitive/aggregate values, lexical
environment storage, external roots, suspended-future retention, and cyclic
graphs.

The next increment adds typed decoding and a resumable expression evaluator for
number/boolean/JSON-value literals, lexical references, object members and array
index/length members, arrays with array/string spreads, and objects with
named/computed keys and object/array spreads. Numeric property keys use
JavaScript-compatible number formatting. Other forms are rejected explicitly
rather than yielding placeholder values.

Pending operands and partial results are GC roots. Execution uses explicit
frames, permits collection between frames, and services collection debt after
each step. Evaluation and cleanup of pending trees have tests at 20,000 levels.
Thirty-one shared expression fixtures are checked against both Rust and
TypeScript; the Rust runner additionally forces full collection after each
frame.

String expressions now evaluate literal and embedded segments in order.
Primitive conversion, ordinary object formatting, iterative nested-array
joining, and JavaScript-compatible number formatting are covered. Unary `not`
uses JavaScript truthiness. Deeply nested strings and negations also execute and
clean up iteratively. Cyclic-array conversion fails explicitly pending parity
work; callable object conversion hooks are not yet supported.

### Integrated runtime continuation

Expression syntax is flattened into immutable shared programs. Closures reuse
their body without recursively cloning syntax; both compilation and destruction
are stack-safe for the tested 20,000-level inputs. Real invocation and lambda
execution share the evaluator's explicit frame stack. Arguments are evaluated
left to right, spreads expand in place, parameter patterns run one frame at a
time, and the caller's context is restored on success and error.

Pattern execution has typed decoding, explicit continuation frames, GC-rooted
inputs/results/branches, retained match trees, failed-branch rollback, and 17
implemented pattern kinds. Twenty-four additional pattern fixtures run in Rust
and TypeScript. The Rust fixture runners collect between every frame. Separate
stress tests service collector debt and force full collection at bounded
intervals rather than imposing quadratic full-GC work on 20,000 live layers.

Provenance consists of immutable wrappers referencing spans only, not matches.
Supported carrying operations preserve wrapper identity, new expression values
use their current match span, and strings retain compact character runs through
concatenation and nested streams. GC tests prove retaining output values does
not retain their producing match trees. Pattern errors are sticky, and failed
lambda bodies unwind their invocation environment and release parameter
allocations.

The standalone Rust citation audit is
[traceability.test.ts](../test/rust/traceability.test.ts). It discovers every
inline `#[test]`, requires citations, and resolves them against actual
requirement documents. It supplements, rather than fakes, the specs auditor's
missing Rust test discovery.

### Remaining runtime inventory

Implemented runtime surface: all in-scope expression forms; declared funcs and
closures; all 36 default globals; all current pattern kinds; rules, parameter
binding, backtracking, recursion, memoization, recovery, diagnostics, metadata,
and host-call/async-input suspension. Shared differential fixtures and
requirement-cited runtime tests cover these areas, including forced collection
at execution boundaries. Native JavaScript AST escape hatches and implicit
composite/callable-to-text or callable-to-JSON conversion are intentionally
rejected under the recorded compatibility decisions.

Remaining runtime gates:

- The standard-library specification, API-surface requirement, all-global
  edge-case matrix, and identity/undefined/native/error/provenance differential
  coverage are complete under milestone 1.
- Milestone 5's incremental-edit and eviction acceptance is complete under the
  approved conservative reachability contract. Recovery and unproven computed
  domains are re-evaluated; retained input, delivered graphs, and live
  backtracking windows are not subject to a universal constant-memory limit.
- The declared compatibility baseline and global differential matrix are
  complete; see milestone 1. Broader acceptance remains tracked by the
  subsystem-specific gates above.
- General performance/memory acceptance and all six release-platform builds
  remain open. The Rust compile comparison is workload-specific and remains
  slower than Deno.

### CLI acceptance inventory

The command implementations and core source/AST execution paths are present and
have end-to-end coverage. The table records the reference behavior; complete
flag-combination and output/exit-code parity remains open.

| Command   | Input and behavior to preserve                                                | Output and failure checks                                                      |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `compile` | Files/globs; project discovery, imports, outDir, overwrite policy             | Mirrored ModuleDeclaration artifacts; per-unit failures; no import re-lowering |
| `parse`   | Path, `-`, implicit stdin, `-e`/`--eval`; `--lang`; reject `--ast`            | Raw syntax AST; parse diagnostics on stderr                                    |
| `exec`    | Expression source or explicit `--ast`; reject language overrides              | Uffda value display by default, explicit `--json`, expression errors           |
| `match`   | Pattern source or explicit `--ast`; mutually exclusive text/file/JSON subject | Raw match value; human rightmost-failure diagnostics or `--json`               |
| `run`     | Module source or explicit `--ast`; exported `--entry`; text/file/JSON subject | Raw rule value; module, matching, and recovery diagnostics                     |
| `fmt`     | Files/globs, default discovery, standalone `-`, custom project formatters     | In-place formatting or no writes with `--check`; refuse unclean parses         |

Global/process checks include help/version, explicit mode conflict diagnostics,
compile fallback only when arguments exist, successful root usage with no
arguments, cwd/config resolution, JSON error code/message/phase, and exit codes
0 (success), 2 (usage), 3 (configuration), and 70 (internal), plus
command-specific failure exits. MCP session/tool surface is landed for cutover;
LSP is still expanding (milestone 10). All six commands now have
relocated-binary coverage outside the checkout with an empty `PATH`, and 29
validation diagnostic cases are shared with the reference. Exhaustive
per-command flag combinations and successful-output comparisons remain open.

### Coordinator integration checkpoint

- [x] Build the `uffda` Cargo binary and run AST `exec` and `match` without
      Deno.
- [x] Verify four process-level tests covering stdin, file input, scalar/text
      subjects, string/JSON results, runtime failures, and exit code 2.
- [x] Verify CLI mode-precedence unit tests and iterative JSON output tests,
      including cyclic-value rejection and numeric-key ordering.
- [x] Expand the Rust requirement-citation audit to integration tests.
- [x] Wire native globals and `echo` into AST `exec`, verified through the
      binary.
- [x] Integrate rooted expression callbacks, host async execution, and
      value-path tests. Remaining edge-case parity is tracked in milestones 1
      and 4.
- [x] Complete source `run`, `exec`/`match`, `parse`, `compile`, and `fmt`
      through the existing self-hosted languages; exhaustive flag combinations
      and outside-checkout acceptance remain open in milestone 7.

Run the current preview from the repository root:

```sh
printf '%s' '{"kind":"number","value":42}' |
  cargo run --manifest-path rust/Cargo.toml --bin uffda -- exec --ast
printf '%s' '{"kind":"any"}' |
  cargo run --manifest-path rust/Cargo.toml --bin uffda -- match --ast --input hello
```

AST input comes from a path or stdin, not `-e`, preserving the existing CLI
restriction. Unsupported source/command surfaces fail explicitly; these checks
do not establish full CLI parity. Parent owns CLI/output/module integration and
this plan; the two implementation agents own globals and patterns, and the
existing resolver worker owns package/graph resolution. Work remains local with
no commits, pushes, release changes, or temporary Rust toolchain overrides.

Latest verified Rust checkpoint: 139 library tests, one build-artifact byte
identity integration test, and five CLI process tests passed. The CLI also now
uses the retained rightmost pattern failure for human/JSON diagnostics (new
process test awaiting the next stable validation window). The full TypeScript
suite passed 842 tests and 2342 steps, with one ignored step; grammar formatting
and lint passed.

Later targeted verification:

- [x] All 32 resolver tests pass, including package integrity/offline cache,
      lockfile behavior, shared semver/graph corpora, and shared import-map
      unfurling.
- [x] Source expansion verifies recursive/brace globs, exclusions, missing
      inputs, directory rejection, and deduplication after lexical path
      normalization.
- [x] The Rust citation audit passes after adding source-command, project, and
      formatter tests.
- [x] Repository `deno fmt` and `deno lint` pass without regenerating artifacts.
- [x] Validate the new hook-aware CLI output path end to end. Published CLI
      checks establish that native `toJSON` hooks execute, async lambda hooks
      produce Promise-shaped `{}`, and `--json` undefined produces the literal
      `undefined` line. Do not await a lambda hook merely to make its output
      resemble synchronous JavaScript.
- [x] Pass the real embedded expression/pattern/Uffda/compiler/formatter tests
      and all executable source-command tests.

The latest stable integrated worker validation passed 226 Rust library tests,
one artifact test, and twelve executable tests, plus strict all-target Clippy.
Parent reran all twelve executable tests and all four embedded-language tests
successfully. Iterator-protocol draining, omitted undefined literals, recovery
VM scheduling, and the captured parameterized-rule formatter failure are fixed.
The source adapter now correctly supplies one scalar source string, not an
iterable stream of its characters. No grammar or artifact changes were needed.

Parent integration now includes source `parse`/`exec`/`match`/syntax-AST `run`,
file/glob `compile`, project discovery/validation using `ModuleSpecifierText`,
and a metadata-selected formatter API. `fmt` now has stdin, explicit files,
default/glob discovery, opportunistic skipping, directory exclusions, JSON
results, and write-free `--check`. Project-language registration evaluates
metadata without invoking entry-rule bodies, validates ids/extensions, rejects
duplicate claims, and permits overrides of built-in ownership. Targeted
formatter stdin/files/check/idempotence/exclusions and language-ownership tests
pass. Custom nonexported formatter process coverage now verifies
canonical-member startup, artifact loading, ownership conflicts, project
overrides and built-in stdin without changing module exports. `compile` uses
shared resolver path/import-map helpers and writes only the existing compiler's
ModuleDeclaration result, not a migrated artifact shape.

The Cargo build validates a complete source/artifact path set before embedding.
Run bin-regenerating commands serially, never concurrently with Cargo: some Deno
tests remove fixture artifacts, so regenerate using the previous published
compiler **after** a full Deno test suite and **before** the final Cargo build.
No post-compile artifact rewriting is involved.

### Verified command integration and remaining gates

The next required layer is the general rule VM, not a handwritten source parser
or a grammar-specific escape hatch. The rule worker owns new runtime files; the
pattern worker owns shared input/cursor and captured-argument request APIs, and
the expression worker owns reusable rooted expression execution. Parent owns
CLI/module/builtin integration.

Completed and directly tested:

- Retained diagnostic provenance follows actual input/cursors through nested
  streams, GC, recovery and memoized copies. Ordered summaries use the real
  `[Documentation]` explanations.
- Recovered `parse` emits its AST and diagnostics/nonzero. `compile` and `fmt`
  reject recovered input without writes; compile preserves every per-unit
  diagnostic and top-level failure.
- Recovered modules and standalone patterns emit values plus
  diagnostics/nonzero. Standalone matching uses the same graph-free VM recovery,
  native globals and rooted serialization, not a separate CLI matcher.
- Stream diagnostic codes, language, source path and zero-based location shape
  are preserved. Recovered operations preserve `span` / `inputSpan`.
- Skipped recovery preserves its skip kind; repetitions omit its value. The
  actual missing-semicolon AST matches the published CLI without AST filtering.
- Source/AST commands, native JSON hooks, rightmost failures, formatter
  stdin/files/globs/check, custom formatters, ownership and configuration/option
  failures have executable tests.
- Full Deno validation passed 849 tests / 2357 steps (one ignored step), grammar
  formatting and lint passed, and the previous published compiler restored
  complete embedded artifacts. Rust release build and standalone source
  exec/parse/match/run/fmt smoke tests passed with user runtime tools removed
  from `PATH`.

Remaining work is not waived:

1. Continue from the verified command checkpoint below; do not redo the
   completed CLI wiring. Extend acceptance coverage as the remaining runtime
   contracts are resolved.
2. Resolve remaining value-model parity boundaries before claiming complete
   migration: JSON AST lone surrogates are rejected by `serde_json`; UTF-16
   indexing/slicing can yield lone surrogates that Rust `String` cannot
   represent. Automatic Promise scheduling/unhandled rejections and remaining
   non-JSON behavior are also unimplemented. The user resolved callable-source
   parity deliberately: reject composite/callable implicit text conversion and
   callable JSON, never reproduce JavaScript implementation-source disclosure.
3. Complete incremental-edit/eviction, async scheduling, comprehensive
   non-JSON/prototype-value and differential coverage. Current rule/GC/shared
   corpus successes do not close these enclosing gates.
4. Compare performance/memory and validate all six release platforms. Linux
   alone is not cross-platform acceptance. Do not change release wiring,
   publish, commit or push without authorization.

Preserve the parent shared helpers (`normalize_path` and `unfurl_specifier`).
Callback-aware expression/pattern/module/language serialization is rooted in the
actual evaluator/rule VM. Serializer stress tests now verify 20,000-level
outputs, linear active-path storage, bounded execution frames, GC safety, shared
siblings, cycles, and reentrant hooks. No commits, pushes, or releases are
authorized.

The module binding layer already executes declared/imported funcs and verifies
global shadowing, parameter failures, shared identity, and cyclic reclamation.
Attribute programs execute through the rule runtime; metadata-only startup does
not run entry bodies. Real source language, compiler, and formatter execution is
verified. Incremental, async, value-model and release gates remain open.

### Original validation record (2026-10-10)

| Check                                                            | Result                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Rust `cargo fmt` and `cargo clippy --all-targets -- -D warnings` | Passed                                                              |
| Rust `cargo test`                                                | 64 passed, 0 failed                                                 |
| Shared differential fixtures                                     | 31 expression cases and 24 pattern cases pass in both runtimes      |
| Rust requirement-citation audit                                  | Every inline Rust unit test cites existing requirement documents    |
| `deno fmt`, `deno task fmt:uff`, `deno lint`                     | Passed                                                              |
| `deno task test`                                                 | 832 passed, 2274 steps, 0 failed; 1 ignored step                    |
| Specs audit                                                      | 0 errors, 86 warnings, including undiscovered inline Rust citations |
| Editor diagnostics and `git diff --check`                        | Clean                                                               |

The published compiler alone regenerated language artifacts during Deno
validation. No generated artifacts were rewritten, seeded under source, or used
to claim Rust language execution. No commits, pushes, tags, release changes, or
production switch were performed. Existing staged and unstaged work remains
preserved; the new continuation changes are local.

### Coordinator verified command checkpoint

| Check                           | Result                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Full Rust suite                 | 247 library tests, 1 embedded-artifact test, 18 executable CLI tests; all pass                                    |
| Strict Rust checks              | `cargo fmt --check` and all-target Clippy with warnings denied pass                                               |
| Full TypeScript reference suite | 849 tests / 2357 steps pass; one ignored step                                                                     |
| Shared differential corpus      | 14 tests / 137 steps pass; Rust citations verified                                                                |
| Formatting/reference lint       | `deno fmt`, grammar formatter, `deno lint`, final format/whitespace checks pass                                   |
| Bootstrap                       | Previous published compiler regenerated complete language artifacts after Deno tests                              |
| Standalone binary               | Optimized Linux binary built; all six commands smoke-tested in an isolated project with `/usr/bin:/bin` as `PATH` |
| Cleanup                         | Coordinator smoke files and known failed-test temporary workspaces removed                                        |

The command/runtime integration checkpoint is persistent, but the entire
migration is **not complete**. No commits, pushes, tags, release changes or
production cutover occurred.

#### Resolved conversion contract and resume instructions

Verified reproductions:

```sh
# Both in-tree runtimes now reject callable and composite interpolation.
./rust/target/release/uffda exec -e '"{add}"'
./rust/target/release/uffda exec -e '"{[1 2]}"'

# CLI value display is separate from implicit text coercion.
./rust/target/release/uffda exec -e '[1 2]'
# [1 2]
./rust/target/release/uffda exec -e '{ a: [1 2] }'
# {["a"]: [1 2]}

# Rust's current JSON/String model rejects this valid JS string value.
printf '%s' '{"kind":"value","value":"\ud83d"}' |
  ./rust/target/release/uffda exec --ast
```

The user explicitly rejected universal `.toString`: scalars retain text
representations, while objects/arrays/callables require authored conversions.
Patterns/expressions are preferred for serialization/parsing. Explicit
`(json v)` remains available for data objects/arrays; callable
roots/properties/elements fail rather than exposing source, omitting values, or
substituting null. Default CLI value output uses a separate Uffda renderer,
without invoking hooks. Existing `--json` compatibility was explicitly retained
after clarification. No `parse_json`, reflection, new native global or new
grammar feature was added.

Specifications, requirements (`runtime-core-012`, `cli-exec-002`), TypeScript
reference behavior, shared fixtures and Rust implementations now encode that
decision. The 72-case interpolation matrix now verifies expected composite
conversion failures as well as successful scalar cases.

Latest verification supersedes the preceding checkpoint counts:

- Rust: 262 library tests, 1 artifact test and 19 executable CLI tests pass;
  strict Clippy, formatting and optimized release build pass.
- TypeScript: 862 tests / 2357 steps pass, one ignored step; full lint and
  grammar formatting pass. The published compiler regenerated artifacts after
  tests.
- Default display round-trips the tested object/array notation through the real
  source grammar. Unsupported values and numbers not representable losslessly by
  the existing grammar fail explicitly.
- Standalone optimized binary verifies Uffda object/array output, explicit JSON
  and interpolation rejection with user runtimes absent from `PATH`.
- Shared differential corpus: 14 tests / 137 steps pass, including Rust
  requirement citations. Specs audit: 0 errors / 83 warnings.

Next foundational work is a lossless UTF-16/WTF-8-capable value and AST string
model, including JSON ingestion/output, indexing/slicing, iteration, property
keys, provenance and grammar positions. Do not substitute replacement characters
or add local surrogates-only patches. Follow with remaining prototype/async and
incremental/eviction acceptance, performance/memory comparisons, and
six-platform build/smoke verification. Keep release/cutover tasks open under the
user's no-commit/no-push/no-release restriction.

Execution-limit handoff: the callable/composite decision is fully integrated and
verified, not an outstanding design blocker. Resume with the lossless string/AST
model above and codec v1 contract design (milestone 8), then the remaining
acceptance gates; do not redo CLI display or restore JavaScript composite
coercion. All implementation agents are idle and their changes are integrated.
The optimized binary is built locally. Preserve the existing dirty/staged
worktree and do not commit, push or change releases.

## Async normalization and codec framing checkpoint

The Rust value model no longer contains Promise values. Native and authored JSON
hooks/iterator factories run through ordinary call continuations and consume
completed results. Iterator result records are unwrapped before reading protocol
fields; the formerly nonterminating authored iterator regression now completes.
Shared fixtures explicitly distinguish Rust completed-hook output from retained
TypeScript host Promise serialization.

`ExpressionExecution::step_status` exposes Complete, Yielded and Suspended. The
first checkpoint supported rule/projection requests only. The subsequent host
execution foundation adds explicit host callable values, rooted requests, safe
re-entry materializers and `Evaluation::drive`, an executor-independent future
driver. Actual Pending/wake behavior, ordered children, collection,
foreign/stale completions and cancellation have requirement-cited coverage.
Pattern-owned expression and rule-runtime host driver integration now forwards
requests through the owning continuation and uses a shared driver. Asynchronous
stream input remains open.

The codec's structural streaming layer is implemented and exported with 11
requirement-cited tests. It does not yet parse or construct data values, settle
native tags or replace the existing CLI renderer.

Fresh integration gates:

- Rust: 274 library tests, 1 embedded-artifact test and 19 CLI process tests
  pass. Strict all-target Clippy, Rust formatting and optimized CLI build pass.
- Deno: 862 tests / 2357 steps pass with one ignored step; grammar formatting,
  full lint and formatting checks pass. Published compiler bootstrap was rerun
  after the Deno suite.
- Specifications audit: 0 errors / 84 warnings.

Two confirmed stuck processes were terminated. The user explicitly authorizes
terminating any process spawned for this migration without asking again; never
terminate unrelated processes. This supersedes the previous no-cancellation
constraint for owned processes.

The source-level smoke test additionally exposed unserviceable lambda rule
requests spinning in standalone execution; the driver now reports an
unknown-reference error instead. The bounded regression and real-source CLI
tests cover successful authored hooks and unresolved rule requests.

Resume with the lossless string/AST model, real external async
suspension/driver, codec value grammar and native encoding/decoding, then
incremental/eviction, performance and six-platform gates. Do not restore Promise
language values or claim the entire migration complete. No commits, pushes, tags
or releases were created.

### Host execution integration verification

Root-safe host execution now covers ordinary expressions, authored parameter
patterns, Projection/Into/Pipeline, iterator callbacks and rule/attribute/
decorator initialization frames. `Evaluation::drive` and `Runtime::drive` share
the executor-independent driver. Retained arguments and results remain readable
within their owning arena after child completion; cancellation and errors clean
up frames and memo dependencies. Public API tests exercise actual Pending/wake
and return the original composite argument without changing its identity.

Fresh final gates: 305 Rust library tests, 1 artifact test, 19 CLI process tests
and 2 public-host integration tests pass. Strict Clippy, Rust formatting and
optimized CLI build pass. Deno: 863 tests / 2357 steps pass with one ignored
step; grammar formatting, full lint and formatting pass. Bootstrap regenerated
artifacts after Deno. Specification audit reports 0 errors / 85 warnings.

Measured whole-process startup plus tiny source commands on the shared Linux
host (five warm samples, medians): Rust exec 274.3 ms vs Deno 263.2 ms; Rust
match 269.0 ms vs Deno 135.3 ms. No performance improvement is claimed. These
measurements include language loading and compilation, not just evaluator
throughput; investigate before marking the performance gate complete.

Remaining foundations: asynchronous input delivery; full lossless Value/AST/
property-key integration; codec value grammar/native encoding and decoding;
incremental editing and eviction acceptance; performance and six-platform
verification. Production release/cutover stays unchanged.

### Lossless text implementation details

The new `rust/src/text.rs` primitive stores UTF-16 code units and distinguishes
runtime text from scalar host strings. JSON string tokens preserve isolated
surrogates; encoding escapes them instead of emitting invalid UTF-8 or
replacement characters. Iteration groups only valid high/low pairs, and ordering
compares code units. A shared Deno/Rust corpus captures controls, escaped
punctuation, astral characters and isolated units; the exhaustive Rust test
round-trips all 65,536 individual units.

This is a foundational module, not completion of the string migration.
`Value::String`, AST literals/property names and existing native operations
still require consistent migration before the compatibility gate can pass. Do
not use the new module to claim arbitrary AST JSON lone-surrogate ingestion is
already supported.

Typed JSON string fields and map keys can now deserialize directly into the
lossless primitive using a validated WTF-8 boundary; all 65,536 individual units
round-trip through typed serde deserialization as well as the dedicated token
codec. Invalid byte encodings fail explicitly. This does not change scalar-only
`serde_json::Value` or complete the runtime/AST migration.

### Immutable declaration loading and compilation

Embedded declarations register unmodified source bytes and decode on first
normal resolver access. Unused malformed declarations remain deferred; accessing
one reports the normal decoding error. Replacing registered sources invalidates
their decoded declarations and linked graph cache.

Overlapping language graphs now share compiled modules only when their source
declarations are pointer-identical immutable resolver objects. Runtime bindings
remain graph-specific. Equal-looking but separately allocated declarations are
recompiled and validated; changed or malformed declarations cannot reuse stale
programs. Tests verify both rejection and shared callable/rule identity.

The integrated Rust suite at this checkpoint passes 315 library tests, 1
artifact test, 19 CLI tests and 2 public-host tests; strict Clippy and optimized
build pass. These counts include intermediate async-input implementation, which
still requires its dedicated acceptance tests. Final formatting and Deno gates
will run after the input integration settles.

Seven warm whole-process startup samples after compilation reuse give medians of
284.2 ms for tiny `exec` and 273.7 ms for tiny `match` on this shared Linux
host. Deferred decoding alone previously measured 276.2 / 269.6 ms. Neither
change demonstrates a startup improvement over the recorded baseline; the
performance acceptance gate remains open.

### Asynchronous input integration

External input now suspends patterns and rule execution on actual unknown
availability, rather than treating it as EOF or collecting the whole stream. The
shared external driver distinguishes host invocations and input requests; each
source has at most one outstanding delivery. Rich runtime values remain rooted
across suspension and collection. Cached positions preserve backtracking, rule
memo identity, nested Into traversal and iterator callbacks without repeating
producer side effects.

Requirement-cited tests cover Pending/wake, lazy consumption, EOF, sticky
errors, stale/foreign completions, cancellation and collection. A public API
integration test additionally proves exactly one request for a one-item pattern,
without read-ahead or an unnecessary EOF probe, and collector-safe composite
delivery. The existing host-only driver remains compatible.

Memo eviction remains unimplemented: delivered prefixes are retained and copied
on append. Do not claim bounded retained-memory or scalable append performance
from this functional async-input acceptance.

Final serialized validation after integration: 327 Rust library tests, 1
artifact test, 19 CLI process tests and 3 public host/input tests pass. Rust
formatting, strict all-target Clippy and optimized build pass. Deno formatting,
grammar formatting and full lint pass; 863 tests / 2357 steps pass with one
ignored step. The previous published compiler regenerated artifacts after the
Deno suite, before final Rust validation. No commits, pushes or releases.

### Structurally shared input prefixes

External delivery no longer copies the entire prefix on append. Immutable
binary-tree snapshots share untouched branches and preserve earlier lengths,
values and provenance; append and indexed lookup take logarithmic work.
Synchronous fixed inputs keep their original vector allocation and identity.
Pattern scopes, requests, match provenance, rule continuations and iterable
callbacks read the same snapshot interface. Host-created fixed streams convert
to `InputBuffer` with `.into()`.

Allocation acceptance tests exercise 4097 appends: each allocates at most one
leaf plus logarithmic branch nodes. With only the latest prefix retained,
collection leaves at most `2N + usize::BITS` storage nodes. Separate tests prove
old snapshots stay unchanged and do not retain subsequently appended cyclic
values once the newer snapshot is dropped. A 257-item asynchronous rule test
checks every retained leaf's value and span after collection across growth
boundaries.

The larger input snapshots exposed an oversized expression parameter frame;
boxing that child continuation avoids inflating every evaluator frame. Existing
suspended authored-parameter tests explicitly verify the owning frame and
collector-safe arguments.

This removes quadratic prefix-copy work, not all retention limits. Live sources
still retain the full delivered prefix; many retained historical matches and
memo entries can retain additional shared branch versions. Memo eviction and
whole-runtime bounded-memory acceptance remain open. No wall-clock performance
improvement is claimed from allocation tests alone.

Final gates for this increment: 332 Rust library tests, 1 artifact test, 19 CLI
tests and 3 public host/input tests pass; strict Clippy, formatting and
optimized build pass. Deno: 863 tests / 2357 steps pass with one ignored step,
full lint, formatting and grammar formatting pass. Published bootstrap
regenerated artifacts after the Deno suite and before Rust validation.

### Authored native data codec

V1 now has an approved value contract: comma-free containers, JSON escapes,
fixed date/bytes/registry-symbol/set/map/error tags, no metadata header, and
explicit rejection of cycles, shared composites and local symbols.
`src/lang/data/data.lang.uff` parses through the ordinary resolver and published
compiler bootstrap; it produces safe token-bearing data ASTs, not executable
expressions. Companion Deno tests cover syntax and focused failure locations.

`rust/src/codec/data.rs` constructs a flat owned native document with exact
BigInt, millisecond dates, bytes, lossless strings and registry-symbol keys.
Compact and pretty encoding preserve insertion order and native payloads. The
bounded writer prevents output growth past the configured byte limit. Incoming
ASTs are flattened iteratively so successful and failed construction, including
invalid options and 10,000-level input, do not recursively destroy host JSON.
Physical container nesting, including map entry pairs, determines depth limits.

`DataDecoder` combines the existing framer, authored grammar and fixed
construction. Each call returns at most one record with its frame span and
consumed-byte count; malformed syntax/payloads poison delivery until reset.
Tests traverse every two-chunk byte split of a mixed UTF-8/native stream, plus
one-byte compact/pretty round trips, exact byte-limit boundaries, duplicates,
alias rejection and cancellation.

The collector-backed runtime now has genuine BigInt, Date and Error values.
`DataDocument::materialize` constructs them inside the arena; iterative
`DataDocument::from_value` exports supported trees and rejects aliases, cycles,
symbol keys and execution values. GC tests prove Error causes remain traced and
the native graph is reclaimed after roots are dropped. Ordinary JSON rejects
BigInt, serializes Date as UTC RFC3339 and emits an Error without enumerable
fields as `{}`; codec encoding remains lossless and preserves a valid date's
offset. These additions do not yet provide a CLI codec selection.

### Lossless runtime integration and combined validation

Lossless UTF-16 is now wired through runtime string values, symbols, property
keys, expression/pattern ASTs, native string operations, provenance, module
decoding and JSON/CLI boundaries. Typed structural JSON preserves escaped
isolated surrogate units; scalar-only host boundaries fail explicitly instead of
substituting replacement characters. Native operations retain their distinct
code-unit versus code-point contracts.

DataLang converts its matched AST directly and iteratively into owned JSON
structure. It no longer serializes and reparses through an unrelated JSON depth
limit. Actual source parsing accepts the full default 1,024-container boundary
and rejects the next opening delimiter. Codec tests additionally round-trip
every individual UTF-16 unit and lossless quoted property keys.

Final serialized gates: 367 Rust library tests, 1 artifact test, 19 CLI process
tests and 3 public host/input tests pass. Rust formatting, strict all-target
Clippy and optimized build pass. Deno formatting, grammar formatting and lint
pass; 867 tests / 2408 steps pass, with one ignored step. The previous published
compiler regenerated artifacts after Deno validation and before final Rust
validation. Specification audit reports 0 errors and 87 warnings, including
Rust-only test citations not discovered by the current audit.

Next codec work is explicit CLI input/output selection, end-to-end command
acceptance and representative compressed/uncompressed size/throughput/memory
measurements. Runtime parity, memo eviction, broader performance acceptance and
six-platform validation remain open. No commits, pushes, tags, releases or
production cutover.

### Native runtime materialization validation

The codec tree now materializes into first-class GC-backed BigInt, Date and
Error values and exports back through a stack-safe graph walk. Date/error
identity, BigInt value equality, date precision, explicit JSON behavior,
alias/cycle rejection, a 10,000-level runtime graph, exact stream EOF/comment
cases and Error-cause retention/reclamation have targeted tests.

Final Rust gates for this increment: 375 library tests, 1 embedded-artifact
test, 19 CLI process tests and 3 public host/input tests pass. Rust formatting,
strict all-target Clippy and optimized build pass. Rust requirement citation
audit passes. Existing Deno gates from the immediately preceding integration
remain 867 tests / 2408 steps, formatting, grammar formatting and lint clean;
this increment changes no Deno source or `.uff` grammar. No cutover is claimed.

### Rust compile-path profiling and batching

On the same Linux host, a release Rust compile of the 70 language grammars
initially had a 50.75 s median, versus 17.12 s for Deno. Profiling attributed
about 53 s of an instrumented run to authored-language execution and about 1 s
to compiler lowering; JSON serialization and diagnostics were negligible. That
run executed about 95 million scheduler steps across parse/lower work.

`Runtime::run` now batches up to 512 internal steps within a rooted collector
mutation and collects debt between batches. The public one-step and suspension
interfaces remain unchanged. A test compares batched execution with individually
stepped execution while forcing collection after every step, across multiple
batch boundaries. Recursive glob expansion now starts at the fixed path prefix
instead of walking the whole working tree.

Three clean-output trials on the same 70-file glob then compiled successfully
with both runtimes, with zero failures and structurally identical ASTs:

| Runtime          |  Median |    Mean |         Range |
| ---------------- | ------: | ------: | ------------: |
| Rust release CLI | 43.58 s | 43.39 s | 42.31–44.27 s |
| Deno CLI         | 17.70 s | 18.02 s | 17.27–19.09 s |

The selected batching is about 8% faster than a single 64-step-batch trial on
the same glob, but Rust remains about 2.5x slower than Deno. Peak Rust RSS was
about 754 MiB and did not materially change between 64- and 512-step batches.
Larger 4096-step batches were slower and retain more allocation debt, so were
rejected. Algorithm-level pattern/runtime work and memory usage remain
performance priorities; these measurements do not establish general runtime
performance or migration acceptance.

Pattern compile now mirrors Deno's compiled-pattern approach for character
classes and regexp nodes (precompile once, reuse on match), shares And/Then/Or
/Pipeline child-index lists via `Rc`, and avoids cloning variable/resolve names
into every frame. Object property maps were tried and reverted: typical objects
are small enough that `Vec` scans beat `IndexMap`/`HashMap` constant factors.
