# Rust runtime foundation

This crate starts the side-by-side migration described in the
[migration plan](../docs/rust-migration.md). It is not yet the replacement CLI.

## Development

Install a stable Rust toolchain and the platform's native linker, then run:

```sh
cargo fmt --manifest-path rust/Cargo.toml --check
cargo clippy --manifest-path rust/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path rust/Cargo.toml
```

Rust unit tests are co-located with their implementations. Collector integration
tests are in `src/gc_tests.rs` and cite requirements using `req:` comments. The
current specs auditor does not recognize Rust inline tests; verify these
citations separately rather than adding placeholder TypeScript tests to satisfy
its discovery rules.

## Collector evaluation

The initial candidate is `gc-arena` 0.7.0:

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
Primitive and ordinary object text conversion, nested-array joining, and number
formatting preserve the existing semantics. Array text conversion is iterative
and detects unsupported cyclic input explicitly; callable conversion hooks are
not implemented. Deep strings, arrays, and negation are tested at 20,000 levels.

## Pattern and provenance execution

`PatternExecution` supports 17 pattern kinds on the implemented value types. It
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

This is not full runtime parity. Globals, declared funcs, remaining special
references, remaining member/coercion behavior, symbols, maps/sets, property
enumeration, rule execution, metadata, full pattern/provenance behavior, and
async invocation remain to be implemented. Unsupported artifact forms fail
decoding rather than silently producing a value. See the migration plan for the
`and` contract conflict and the explicit TypeScript `max: 0` discrepancy.

## Module loading foundation

Both runtimes now target `.uff` and `.json` modules. Arbitrary `.ts`/`.js`
declaration-file loading is retired in both; controlled host injection is not
file loading. Rust has a filesystem declaration loader with URL-keyed identity,
direct JSON validation, structured read/parse errors, and `.uff` artifact
remapping under an explicit absolute layout. It never reads `.uff` source or
re-lowers imported artifacts. The shared module corpus covers outer declaration
shape validation. Module graph linking, execution, network loading, packages,
integrity, and lockfiles remain separate uncompleted milestones.
