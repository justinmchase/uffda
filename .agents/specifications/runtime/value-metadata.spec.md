# Runtime value metadata

This chapter defines how runtime values — in particular the default runtime
globals — carry descriptive metadata for tooling.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Expression references resolve to local bindings, declared funcs, and then
runtime globals (see [reference expressions](../expressions/reference.spec.md)).
Declared funcs are described from their declarations, but globals are host
functions with no declaration. Value metadata lets tooling (for example LSP
hover) describe a global from the global itself, rather than from a separately
maintained documentation table that can drift from the runtime.

## Metadata symbol

- Value metadata MUST be stored under the well-known symbol
  `Symbol.for("uffda.metadata")` (exported from the runtime as `METADATA`).
  Because it is a registered symbol, a host that supplies its own globals MAY
  attach metadata without importing the runtime's helper.
- Function metadata MUST have the shape
  `{ description: string, parameters: { name: string, optional?: boolean, rest?: boolean }[] }`:
  a one-line description and the parameters in invocation order. `optional`
  marks a parameter that may be omitted; `rest` marks a parameter that collects
  all remaining arguments.
- Metadata MUST be inert: attaching it MUST NOT change the value's behavior, and
  MUST NOT be visible to ordinary enumeration (it is a non-enumerable,
  read-only, frozen property). Evaluation MUST NOT read it; it exists only for
  tooling.
- Readers MUST validate the shape and treat missing or malformed metadata as
  absent rather than trusting it.

## Wrapped arguments and results

Globals, default and host-supplied alike, receive wrapped arguments and follow
the globals contract of [value provenance](./value-provenance.spec.md#globals):
rearranging globals carry the values they move, computing globals observe raw
inputs, and a raw result is wrapped with the evaluating Match's source span.
Globals never inspect origins.

### Writing a global

A global author follows four rules; provenance then needs no further thought:

1. **Observe raw.** Read an argument's raw value with `rawOf` before testing or
   computing with it (`unwrap` for a deep, raw copy). Coercion (`a + 1`,
   `` `${s}` ``, `a == "x"`) already sees the raw value, but identity (`===`),
   `typeof`, and property access see the wrapper.
2. **Return raw when computing.** A computed result is returned raw; the runtime
   wraps it with the invocation's source span.
3. **Carry what you rearrange.** Elements, properties, and callback results that
   are moved rather than inspected are placed in the result unchanged, so each
   keeps its own origin (for example `filter` returns the wrapped elements it
   kept).
4. **Build strings with the helpers.** A string built from strings uses `concat`
   (and `sliceString` for substrings) so each character keeps its provenance;
   converted non-string parts take the call's origin.

A global that ignores rules 3 and 4 still works; its results fall back to the
invocation's source span.

## Default globals

- Every default runtime global (`defaultGlobals`) MUST carry function metadata.
  A global's metadata MUST be attached in the module that defines the global.
- A function's signature is written as its invocation: `(name a b? ...rest)`.
