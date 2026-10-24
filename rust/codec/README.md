# uffda-codec

A strict Rust reader/writer for Uffda data values and newline-framed streams.
This crate has **no Uffda runtime, grammar loader, resolver, or collector
dependency**. Native parsing and fixed tag construction do not execute code.

```rust
use uffda_codec::{from_str, to_string};

let document = from_str(r#"{message:"hello" values:[undefined 42n]}"#)?;
assert_eq!(
    to_string(&document)?,
    r#"{"message":"hello" "values":[undefined 42n]}"#
);
# Ok::<(), uffda_codec::data::DataError>(())
```

`from_str` requires exactly one value, with optional surrounding whitespace and
hash comments. `to_string` emits canonical compact text **without** a trailing
newline. Append LF when writing a stream record. Empty input, extra records,
duplicate keys, unknown tags and executable syntax fail explicitly.

For streams, use `data::DataDecoder::push_some` and resume with the unconsumed
input. Each record carries an absolute byte span. Decode failures expose
`DataError::offset()` and a diagnostic message; failures poison the stream until
reset. Limits default to 16 MiB per record and 1,024 nested containers.
Streaming callers may set stricter resource limits; they cannot configure a
different syntax, coercion policy, custom tag, or converter.

`data::DataDocument` is an owned, flat tree of fixed `DataNode` values: no GC or
recursive tree destruction is required. Native values include BigInt, Date,
bytes, registered symbols, Set, Map and Error. Strings and property names use
lossless UTF-16, including isolated surrogates represented with JSON escapes.
`DataDocument::from_nodes` validates postorder node references and the value
contract before accepting a host-built tree.

The authored data grammar remains available for composition, editor tooling and
source diagnostics. Runtime differential tests compare it with the native
decoder. The runtime crate supplies arena adapters and the pure `to_codec` /
`from_codec` globals. The native reader is not a configurable grammar engine.

Run this crate independently:

```sh
cargo test --manifest-path rust/codec/Cargo.toml
```
