# Rust Uffda runtime migration

This crate starts the side-by-side migration described in the
[migration plan](../docs/rust-migration.md). It includes an AST execution CLI
preview and source-command integration, not yet a complete replacement CLI.

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

AST input comes from a file or standard input, not `-e` (matching the existing
CLI's AST-input restriction). Normal value display uses Uffda notation: arrays
are whitespace-separated and objects use computed quoted keys. Top-level strings
remain plain text. `--json` explicitly selects JSON compatibility output.
Usage/execution failures use exit code 2; invalid project configuration uses
exit code 3. JSON output runs the runtime's serializer, including native and
authored `toJSON` hooks through the same scheduler. Pending work belongs to
execution state, not a Promise language value; Rust deliberately does not
reproduce JavaScript's empty-object serialization of pending hooks.

`ExpressionExecution::step_status` distinguishes completed work, cooperative
yielding and suspension. Explicit host callable values suspend ordinary calls
with rooted arguments. `Evaluation::drive` polls host futures outside collector
mutation scopes; completion returns a retained value or safely materializes a
new value in the originating arena. No executor dependency or Promise language
value is required. Pattern-owned expressions, iterable drains, parameter
patterns and rule execution forward requests to the same owning continuations.
`Runtime::drive` uses the shared host driver; asynchronous input delivery
remains separate work.

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

Default CLI display does not invoke conversion hooks. Cycles, callables, special
runtime objects, symbol keys and values without a lossless representation in the
existing grammar fail explicitly. The current numeric grammar only supports
integral literals; the renderer emits safe integers (negative values use
`(sub 0 magnitude)`) and rejects fractional, nonfinite, negative-zero and unsafe
integer values rather than inventing syntax.

This preview must not be treated as full runtime parity. Unicode lone-surrogate
values, remaining async/incremental acceptance and release-platform validation
remain migration gates.

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
