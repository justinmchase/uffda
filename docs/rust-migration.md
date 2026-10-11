# Rust Uffda migration

Tracking issue: [#277](https://github.com/justinmchase/uffda/issues/277).

## Goal and agreed scope

Implement a Rust Uffda runtime and standalone CLI, not a new Deno runtime.
Preserve the language and command contracts without new language features.

Approved scope extension (2026-10-10): design and implement **Uffda data codec
v1**, a small built-in textual data format with native-type round trips and
streaming records. This deliberately extends the original no-new-features scope;
the syntax examples are proposals until specifications and requirements settle
their contracts. Existing compiled JSON artifacts and bootstrap remain
unchanged.

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

MCP and LSP are deferred. Binary codec encoding, compiled-artifact format
replacement, executable constructors, arbitrary class reconstruction and
function-source serialization are not part of codec v1.

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

- [ ] Trace specifications and requirements to shared fixtures and Rust tests.
- [ ] Inventory commands, flags, outputs, exit codes, and failure behavior.
- [ ] Inventory the complete pattern, expression, global, and module surface.
- [x] Record the current expression/pattern discriminators and all 36 default
      global names, separating implemented subsets from unresolved contracts.
- [ ] Resolve missing or conflicting contracts with explicit decisions.
- [x] Align module specifications and requirements with the revised `.uff` +
      `.json` boundary in both runtimes and no-re-lowering bootstrap contract.
- [x] Verify removal of TS/JS file importers, JSON declaration validation,
      injected host integrations, package JSON loading, and Rust data loading.
- [ ] Build a differential harness; represent identity, undefined, non-JSON
      values, and provenance without silently reducing them to JSON.

Gate: a defined parity checklist and an explicit discrepancy list.

### 2. Dynamic values and memory management

- [ ] Evaluate maintained tracing collectors before committing the full port.
- [x] Prototype `gc-arena` 0.7 with branded pointers, write barriers, external
      roots, and unreachable-cycle reclamation (inherited 38-test suite rerun).
- [ ] Test primitives, collections, identity, ordering, and coercion.
- [x] Verify primitive strict equality, array/object identity, ordered
      replacement, JavaScript number formatting, truthiness, and basic string
      coercion.
- [ ] Test closures and cycles across values, environments, scopes, and modules.
- [x] Verify captured environment graphs and suspended-future external roots;
      module cycles and actual async invocation remain separate work.
- [x] Execute real lexical closures, preserve retained captures through GC, and
      reclaim an object/closure/environment cycle after releasing its roots.
- [x] Verify actual module callable/environment cycles survive collection
      between execution frames and are reclaimed when bindings/execution drop.
- [ ] Test native callbacks, suspended evaluation, metadata, and provenance.
- [ ] Test roots for execution, memo tables, caches, and retained matches.
- [ ] Force collection between evaluation steps and verify reclamation.

Gate: semantic and cyclic-memory tests pass. Collector integration with actual
evaluation and suspension must be demonstrated; graph-storage tests alone do not
complete this milestone.

### 3. Execution foundation

- [ ] Deserialize existing artifacts.
- [x] Decode the implemented expression subset with typed discriminators and
      explicit errors for unsupported forms.
- [ ] Implement lexical environments and structurally shared immutable scopes.
- [x] Verify structurally shared lexical environment storage, shadowing
      including undefined, and iterative lookup through 10,000 parent layers.
- [ ] Implement input normalization, nested streams, Unicode positions,
      provenance, match trees, errors, and execution frames.
- [ ] Implement ordered awaitable execution and stack-safe rule scheduling.

Gate: foundation tests pass, including deep nesting and scope isolation.

### 4. Expressions and globals

- [ ] Implement every expression form and existing value semantics.
- [x] Verify literals, lexical references, object and array members,
      arrays/objects/spreads/computed keys, interpolation, and unary `not` in 23
      shared fixtures, including collection after every Rust frame.
- [x] Verify execution and pending-tree cleanup at 20,000 nesting levels.
- [ ] Implement invocation, lambdas, funcs, argument binding, and errors.
- [x] Execute lambdas through actual parameter-pattern matching, including
      invocation spreads, lexical captures, repeated calls, sticky errors, and
      restoration of caller context.
- [ ] Implement every current default global in Rust.
- [x] Implement the 36-name native registry, first-class callable lookup, lazy
      callback iteration, symbol/map/set operations, and CLI-only `echo`; shared
      fixtures and rooted native-callback tests pass.
- [ ] Preserve rearranged values' provenance and computed values' call origins.
- [x] Verify span-only immutable wrappers, raw equality, carried-wrapper
      identity, Unicode character runs, concatenation, nested-stream character
      origins, and lambda computation origins. Retained values do not retain
      match trees.
- [ ] Verify supported async behavior.
- [x] Remove first-class Promise compatibility artifacts; consume
      authored/native hook results uniformly through rooted execution
      continuations.
- [ ] Provide explicit suspension/resumption and cooperative scheduling with
      executor-independent host futures; no GC mutation or borrowed state across
      await, and deterministic cancellation/error cleanup.

Gate: expression/global differential fixtures and memory stress tests pass.

### 5. Patterns and rules

- [ ] Implement the full pattern inventory.
- [x] Verify `any`, `ok`, `fail`, `end`, `equal`, `includes`, `then`, `or`,
      `variable`, `maybe`, `not`, `lookahead`, `skip`, `into`, `except`, `type`,
      and `quantifier` on the currently supported value/input types.
- [x] Verify failed-branch position/binding rollback, skip propagation,
      contextual equality, repetition bounds/progress, closed/open end attempts,
      and explicit pattern errors.
- [x] Verify 20,000 nested patterns and calls without host-stack recursion.
- [x] Verify `and`, `between`, Unicode `character`, ECMAScript `regexp`, object
      `over`/rest, `switch`, and rightmost-failure diagnostics.
- [ ] Integrate `projection`, `pipeline`, `resolve` host requests, and `recover`
      with complete rule scheduling and stream identity.
- [ ] Implement lexical rule visibility, parameterized rules, captured inline
      arguments, backtracking, and binding isolation.
- [ ] Implement recursion, memoization, eviction, incremental parsing, recovery,
      and diagnostics.
- [ ] Preserve metadata and provenance.

Gate: pattern, recursion, recovery, and incremental fixtures pass without host
stack overflow on deeply nested inputs.

### 6. Self-hosted languages and modules

- [ ] Execute existing compiled tokenizer, pattern, expression, compiler,
      formatter, and Uffda language modules.
- [x] Verify filesystem declaration identity/remapping, package export and
      integrity/cache/lockfile fixtures, and iterative module graph linking.
- [ ] Compile module declarations into executable rule/func/decorator programs
      and integrate their shared lexical environments.
- [ ] Implement `.uff`/`.json` local/package resolution, exports, identity,
      caching, integrity verification, and lockfiles.
- [ ] Embed unmodified artifacts produced by the previous published compiler.
- [x] Embed a complete authored-language artifact tree without modifying
      artifacts, validate declaration data, and link embedded language graphs.
- [ ] Compile the language sources for the next build.

Imports only load compiled declarations. Never parse or compile on import,
commit compiler seeds under `src/`, or rewrite artifacts after compilation.

Gate: corpus parsing/compilation and published-compiler bootstrap work.

### 7. CLI parity

- [ ] Implement all six commands with source, stdin, inline, and AST inputs.
- [ ] Preserve discovery, paths/globs, machine output, diagnostics, and exits.
- [ ] Preserve custom formatting and `--check`.
- [ ] Test both successful and failing invocations end to end.

Gate: observable compatibility, not merely command availability.

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

- [ ] Write focused codec specifications and requirement-cited acceptance cases
      before implementation, following the repository's specs method.
- [ ] Define exact supported types and round-trip guarantees, distinguishing
      value equality from identity preservation.
- [ ] Define comma-free arrays and records; settle identifier grammar, token
      boundaries and separators explicitly rather than borrowing expression
      syntax implicitly.
- [ ] Support bare identifier keys and quoted literal string keys with identical
      string-key semantics; quoted keys have no interpolation. Reject duplicate
      record keys.
- [ ] Define lossless Unicode/string escaping, fractional and integral numbers,
      BigInt, negative zero, NaN and infinities.
- [ ] Define explicit native tags for bytes, dates/instants, symbols and
      structured errors; decide map/set inclusion and exact tag spelling before
      implementation.
- [ ] Specify date precision/timezone semantics, well-known/global/local symbol
      identity, error fields/causes and reconstruction without arbitrary
      exception classes. A symbol description alone must not be treated as
      identity.
- [ ] Define explicit failures for unsupported values and unknown/invalid tags.
      Never omit values, invent placeholders, expose implementation source or
      silently stringify native values.
- [ ] Keep v1 free of functions, executable constructors, arbitrary classes and
      cyclic graphs. Decide shared-reference/local-symbol handling explicitly;
      reject cases whose required identity cannot be preserved.
- [ ] Make decoding a fixed, validated data operation, not callable lookup,
      imports or arbitrary expression evaluation.

Illustrative only; neither this syntax nor these tags are implemented today:

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
structural framing only, not a data-value decoder or complete codec; the
authored value grammar and native construction/encoding remain pending.

- [ ] Define newline-framed top-level records within the same codec
      specification, not a second JSONL-like language.
- [ ] Permit multiline containers; newlines inside containers are whitespace.
      Outside containers/strings, require a newline between top-level records;
      EOF may terminate the final complete record.
- [ ] Define blank lines, `#` comment-only lines and trailing line comments.
      Comments do not erase record-boundary newlines; `#` inside strings is
      text.
- [ ] Provide compact one-physical-line encoding and pretty multiline encoding
      of the same values. Escape string newlines in compact output.
- [ ] Incrementally decode arbitrary byte chunks, including boundaries inside
      UTF-8 characters, escapes, tags and comments.
- [ ] Emit completed records without retaining prior records; integrate consumer
      backpressure and cancellation with rooted runtime values.
- [ ] Define truncated-record/EOF behavior, record/source locations, explicit
      size/nesting limits and failure behavior. Do not silently resynchronize
      past malformed data.
- [ ] Test mixed scalar/container records, empty streams, comments, final
      records without newline and malformed records.

Gate: chunking cannot change results or errors. Decoder memory scales with the
current record and bounded consumer backlog, not total stream size.

#### 8.3. Optional metadata decision

- [ ] Decide whether v1 includes an optional leading `@meta{version:1}` header.
      No header/version syntax is committed by this plan.
- [ ] If included, define its position before data records, the version when
      absent, unsupported-version errors and separate metadata delivery.
- [ ] Do not add a `multi` flag: structural nesting already determines whether a
      newline terminates a record.
- [ ] Ensure metadata cannot enable imports, executable decoders or
      constructors.

Gate: a reader can interpret an unadorned stream, and any header cannot be
mistaken for application data or silently alter decoding capabilities.

#### 8.4. Authored grammar and Rust implementation

- [ ] Author the data grammar in `.uff` with documented failures and corpus
      tests, preserving the published-compiler bootstrap rules.
- [ ] Define a validated data AST/tag representation and materialize native
      values through a fixed codec boundary; keep genuinely native construction
      in Rust.
- [ ] Implement compact/pretty encoders and incremental decoder with stack-safe
      traversal, deterministic output and explicit failures.
- [ ] Verify GC/root safety across encoding, partial decoding, record delivery,
      suspension, cancellation and failure.
- [ ] Test every supported type's round trip, escaping, malformed input, deep
      nesting, identity policies and native-type reconstruction.

Gate: the actual authored grammar and native runtime work together; generic JSON
fixtures or host-only prototype code are not sufficient acceptance.

#### 8.5. Integration and measured acceptance

- [ ] Replace the interim CLI Uffda value renderer with the codec's defined
      display/encoding policy, explicitly distinguishing raw top-level string
      display from encoded string records.
- [ ] Choose explicit data input/output APIs and CLI selection without confusing
      codec data, expression source and raw AST input.
- [ ] Preserve scalar-only implicit interpolation and explicit existing JSON
      compatibility. Do not add universal `.toString` or automatic JSON
      fallback.
- [ ] Update directly affected specs, requirements, command documentation and
      end-to-end tests in the same change.
- [ ] Measure size, throughput and memory against JSON/JSONL, compressed and
      uncompressed, with representative ordinary and native-type records.
- [ ] Verify standalone Rust operation and streaming on supported platforms.

Gate: lossless supported-type round trips, bounded streaming behavior and
end-to-end commands pass. Readability and size/performance claims have measured
evidence, not assumptions based on punctuation removal.

#### Deferred artifact adoption

Compiled declarations, bootstrap, package resolution, project/lock files and
structured diagnostics retain their current formats. After codec v1 is stable,
evaluate artifact adoption separately: verify JSR asset/entrypoint conventions,
compatibility/versioning and bootstrap upgrade sequencing. Do not replace JSON
artifacts incidentally, re-lower on import or rewrite compiled artifacts. Binary
encoding of the same data model is also deferred.

### 9. Release and cutover

- [ ] Run unit, corpus, integration, differential, and GC-stress suites.
- [ ] Compare performance and memory against the baseline.
- [ ] Build/smoke-test Linux, Windows, and macOS on x86_64 and aarch64.
- [ ] Preserve asset names, checksums, installers, and setup-action behavior.
- [ ] Update implementation-specific specifications and contributor docs.
- [ ] Switch production only after all gates pass.

## Final acceptance

An installed Rust `uffda` runs every in-scope command without Deno installed,
preserves agreed contracts, safely handles dynamic values and closures, and
participates in the published-compiler bootstrap process. The approved codec v1
additionally passes its defined native-type round-trip, streaming, failure and
standalone integration gates. Deferred artifact/binary adoption is not required
for this acceptance.

## Implementation progress

### Continuation baseline (2026-10-10)

The inherited Rust baseline was rerun successfully: 38 unit tests, no failures.
All staged and unstaged work is preserved; work continues directly in this
folder. Granular checks above record evidence, not completion of their enclosing
milestones. No CLI or pattern-runtime parity is claimed.

Known external/design gates:

- Rust and the native linker are now installed normally. Use the normal
  rustup/PATH setup; no repository-local toolchain or linker fallback is
  permitted.
- The standard-library specification remains `SPEC_DEFINITION_PENDING`. Existing
  narrower requirements can govern individual globals, but missing contracts
  must not be invented.
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

Expression forms: number, boolean, JSON value, string, array, object, reference,
member, not, invocation, and lambda are decoded and exercised. Native JavaScript
ASTs are deliberately rejected. Complete member/coercion/non-JSON semantics,
declared funcs, `this`, rule-info references, capabilities, and async invocation
are still open.

Remaining pattern kinds pending full integration: `and`, `between`, `character`,
`over` (including rest entries), `pipeline`, `projection`, `regexp`, `resolve`,
`recover`, and `switch`. Rules, parameterized/captured rule arguments,
memoization, left recursion, eviction, incremental edits, recovery, diagnostics,
and metadata remain open. Open-input repetition tests verify end-attempt
behavior, not incremental stream mutation or async iterators.

The 36 default globals still requiring Rust implementations and explicit
contracts are: `add`, `at`, `base58`, `coalesce`, `compare`, `eq`, `enumerate`,
`filter`, `flat`, `format`, `from_entries`, `gt`, `gte`, `has`, `id`, `int`,
`iterable`, `join`, `json`, `last`, `length`, `lt`, `lte`, `map`, `not`, `one`,
`pack`, `pluck`, `reduce`, `scan`, `sha256`, `slice`, `sub`, `symbol`, `to_set`,
and `when`. The pending standard-library specification is not treated as
permission to invent contracts.

There is now a runnable Rust AST CLI and filesystem/package/graph resolver.
Embedded-language execution and release cutover remain unimplemented. Symbols,
maps/sets, iterators, async suspension in real invocation, and full provenance
through rules/globals/pipelines remain open. Collector selection remains
provisional until those actual-runtime gates pass.

### CLI acceptance inventory

These are reference requirements; full Rust command parity remains open:

| Command   | Input and behavior to preserve                                                | Output and failure checks                                                      |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `compile` | Files/globs; project discovery, imports, outDir, overwrite policy             | Mirrored ModuleDeclaration artifacts; per-unit failures; no import re-lowering |
| `parse`   | Path, `-`, implicit stdin, `-e`/`--eval`; `--lang`; reject `--ast`            | Raw syntax AST; parse diagnostics on stderr                                    |
| `exec`    | Expression source or explicit `--ast`; reject language overrides              | String results as text, other values as JSON; expression errors                |
| `match`   | Pattern source or explicit `--ast`; mutually exclusive text/file/JSON subject | Raw match value; human rightmost-failure diagnostics or `--json`               |
| `run`     | Module source or explicit `--ast`; exported `--entry`; text/file/JSON subject | Raw rule value; module, matching, and recovery diagnostics                     |
| `fmt`     | Files/globs, default discovery, standalone `-`, custom project formatters     | In-place formatting or no writes with `--check`; refuse unclean parses         |

Global/process checks include help/version, explicit mode conflict diagnostics,
compile fallback only when arguments exist, successful root usage with no
arguments, cwd/config resolution, JSON error code/message/phase, and exit codes
0 (success), 2 (usage), 3 (configuration), and 70 (internal), plus
command-specific failure exits. MCP/LSP remain deferred. Complete per-command
flag combinations and installed-binary end-to-end output/exit verification
remain unchecked.

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
- [ ] Complete expression callback/value edge-case parity and async integration.
- [ ] Complete `run`, source `exec`/`match`, `parse`, `compile`, and `fmt`
      through the existing self-hosted languages.

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
