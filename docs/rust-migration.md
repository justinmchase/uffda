# Rust Uffda migration

Tracking issue: [#277](https://github.com/justinmchase/uffda/issues/277).

## Goal and agreed scope

Implement a Rust Uffda runtime and standalone CLI, not a new Deno runtime.
Preserve the language and command contracts without new language features.

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

MCP and LSP are deferred.

Both runtimes support logical `.uff` modules and direct `.json` declarations,
including package exports resolving to either extension. `.uff` retains artifact
remapping without re-lowering; `.json` loads its actual path as data. Explicit
CLI AST input through `--ast` stays supported. Arbitrary `.ts`/`.js` declaration
file imports are retired in both runtimes; explicitly supplied host APIs remain
permitted. Rust additionally retires JS-native expression escape hatches.

All native globals will be implemented in Rust. Arbitrary JavaScript execution
is not required. Existing observable value semantics still need explicit
compatibility tests.

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
- [ ] Verify removal of TS/JS file importers, JSON declaration validation,
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
- [ ] Preserve rearranged values' provenance and computed values' call origins.
- [x] Verify span-only immutable wrappers, raw equality, carried-wrapper
      identity, Unicode character runs, concatenation, nested-stream character
      origins, and lambda computation origins. Retained values do not retain
      match trees.
- [ ] Verify supported async behavior.

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
- [ ] Implement `.uff`/`.json` local/package resolution, exports, identity,
      caching, integrity verification, and lockfiles.
- [ ] Embed unmodified artifacts produced by the previous published compiler.
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

### 8. Release and cutover

- [ ] Run unit, corpus, integration, differential, and GC-stress suites.
- [ ] Compare performance and memory against the baseline.
- [ ] Build/smoke-test Linux, Windows, and macOS on x86_64 and aarch64.
- [ ] Preserve asset names, checksums, installers, and setup-action behavior.
- [ ] Update implementation-specific specifications and contributor docs.
- [ ] Switch production only after all gates pass.

## Final acceptance

An installed Rust `uffda` runs every in-scope command without Deno installed,
preserves agreed contracts, safely handles dynamic values and closures, and
participates in the published-compiler bootstrap process.

## Implementation progress

### Continuation baseline (2026-10-10)

The inherited Rust baseline was rerun successfully: 38 unit tests, no failures.
All staged and unstaged work is preserved; work continues directly in this
folder. Granular checks above record evidence, not completion of their enclosing
milestones. No CLI or pattern-runtime parity is claimed.

Known external/design gates:

- Rust and the native linker are now installed normally. Use the normal
  rustup/PATH setup; no repository-local toolchain or linker fallback is permitted.
- The standard-library specification remains `SPEC_DEFINITION_PENDING`. Existing
  narrower requirements can govern individual globals, but missing contracts
  must not be invented.
- `and` has contradictory authority: the
  [requirement](../.agents/requirements/patterns-runtime/and-001-core.requirement.md)
  mandates caller-visible position P after success; the
  [specification](../.agents/specifications/patterns/runtime/and.spec.md)
  permits final-child consumption and its example uses that consumed result. The
  reference implementation returns position 1 for `and(any, any)` on `[42]`.
  Rust `and` remains unimplemented pending an explicit resolution; no
  contradictory semantics or fake parity test was added.
- The
  [quantifier specification](../.agents/specifications/patterns/runtime/quantifier.spec.md)
  says maximum zero permits zero repetitions. The TypeScript reference returns
  position 1 for `quantifier(any, max: 0)` on `[42]`. Rust obeys the maximum
  bound and has a test proving its child is not invoked at zero. This case is
  explicitly excluded from the passing shared parity set, not concealed as a
  success. Reference correction/acceptance of the discrepancy remains open.
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

Remaining pattern kinds: `and` (contract conflict above), `between`,
`character`, `over` (including rest entries), `pipeline`, `projection`,
`regexp`, `resolve`, `recover`, and `switch`. Rules, parameterized/captured rule
arguments, memoization, left recursion, eviction, incremental edits, recovery,
diagnostics, and metadata remain open. Open-input repetition tests verify
end-attempt behavior, not incremental stream mutation or async iterators.

The 36 default globals still requiring Rust implementations and explicit
contracts are: `add`, `at`, `base58`, `coalesce`, `compare`, `eq`, `enumerate`,
`filter`, `flat`, `format`, `from_entries`, `gt`, `gte`, `has`, `id`, `int`,
`iterable`, `join`, `json`, `last`, `length`, `lt`, `lte`, `map`, `not`, `one`,
`pack`, `pluck`, `reduce`, `scan`, `sha256`, `slice`, `sub`, `symbol`, `to_set`,
and `when`. The pending standard-library specification is not treated as
permission to invent contracts.

There is still no Rust CLI, resolver, embedded-language execution, or release
cutover. Symbols, maps/sets, iterators, async suspension in real invocation, and
full provenance through rules/globals/pipelines remain open. Collector selection
remains provisional until those actual-runtime gates pass.

### CLI acceptance inventory

These are reference requirements, not implemented Rust commands:

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

### Verified validation record (2026-10-10)

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
