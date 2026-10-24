# Uffda data codec

This chapter specifies the data codec's byte-stream framing layer.
[V1 values](data-codec/values.spec.md) defines value syntax, fixed native tags,
identity policy and encoding contracts.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in RFC 2119 and RFC 8174 when, and only when, they appear in all
capitals.

## Definitions

- A **physical line** is a sequence of source bytes terminated by LF (`0x0a`),
  or the final unterminated sequence at end of input.
- A **record** is one raw, valid-UTF-8 physical-line source string, extended
  across lines while inside a nested container. A physical LF inside a quoted
  string is an error.
- A **frame span** is a half-open byte range `[start, end)` into the complete
  input stream. The range covers the record source and excludes its terminating
  top-level LF.
- A **framer** identifies record boundaries and structural completeness. It does
  not parse the record's value grammar.

## Axioms

- Framing is a byte-stream operation: callers may divide the same source at any
  byte boundary, including within UTF-8 encodings, escapes, and comments.
- The framing result and framing errors MUST NOT depend on chunk boundaries.
- A delivered record contains raw source, not a decoded or normalized value.
- The value parser, not the framer, decides whether a framed source is a valid
  Uffda data value and what value it denotes.
- Data decoding MUST NOT execute Uffda expressions, resolve callables, or
  construct values through arbitrary host-language evaluation.

## Constraints

### Record boundaries and lexical structure

- A top-level LF separates records when it occurs outside a quoted string and
  outside `[]` or `{}` nesting. LF inside a container is part of that record's
  raw source.
- A final structurally complete record MAY end at EOF without a final LF.
- Blank physical lines and comment-only physical lines MUST NOT produce frames.
- An unescaped `#` outside a quoted string starts a comment that continues to
  the physical LF. A comment after a value does not suppress that value's record
  boundary. `#` inside a quoted string is source text.
- Quoted strings use backslash escaping for framing: an escaped quote does not
  close a string. A physical LF before the closing quote is an unterminated
  string error.
- `[` and `{` open nested containers; `]` and `}` MUST close the most recently
  opened matching delimiter. A closing delimiter without a matching opener, or a
  different closing delimiter, is an error.
- A physical line that appears to contain more than one value MUST remain one
  frame when it is not nested in a container or string. The actual value parser
  MUST diagnose multiple values and other syntactic errors. Framing MUST NOT
  infer scalar tokens, tag spellings, or whitespace rules from incomplete value
  syntax; for example, a tag and its payload may be separated by whitespace.
- The framer MUST NOT silently skip malformed records to resume at a later
  physical line.

### Incremental operation, spans, and limits

- A streaming framer MUST accept arbitrary byte chunks and deliver each
  completed frame before requiring the rest of the stream. It MUST support
  synchronous consumer backpressure without accumulating an unbounded batch of
  completed frames for one input chunk.
- Each frame MUST carry its valid-UTF-8 raw record source and its half-open
  absolute byte span. The span MUST map the first retained record byte through
  the last source byte in the frame; leading trivia and the terminating
  top-level LF are excluded. Interior newlines and comments are retained in the
  raw source.
- Invalid UTF-8 MUST produce an explicit error, including when EOF occurs in an
  incomplete UTF-8 sequence.
- Unterminated strings, incomplete containers at EOF, mismatched delimiters,
  invalid UTF-8, and exceeded limits MUST produce explicit errors with stream
  byte offsets.
- Implementations MUST enforce explicit, nonzero maximum record-byte and
  nesting-depth limits. The default limits are 16 MiB per record and 1,024
  simultaneously nested delimiters. Record size counts retained record source
  bytes, including interior newlines and comments, but excludes the top-level
  terminating LF and source trivia before the value.
- Retained record source MUST NOT exceed the configured byte limit, and the
  delimiter stack MUST NOT exceed the configured nesting limit. Framer memory
  MUST remain bounded by those limits and fixed-size UTF-8 carry state; normal
  collection capacity rounding is permitted. Previously delivered records MUST
  not be retained by the framer. Memory owned by the caller's input chunks and
  emitted frames is outside this bound.
- A framing failure MUST poison the current stream until reset; the framer MUST
  NOT resynchronize silently. Cancellation discards the unfinished record and
  prevents further input until reset. Reset begins a new stream with byte
  offsets starting at zero. Cancellation, failure, and reset MUST release
  retained record and delimiter-buffer capacities. Finishing closes the stream
  and further feed or finish operations MUST fail until reset. Absolute
  byte-offset overflow MUST fail explicitly rather than wrap or saturate.

## Mechanism

The framer tracks UTF-8 validity across chunk boundaries, quote and escape
state, comment state, the delimiter stack, and the current record's source span.
It emits one frame at a top-level LF or EOF, regardless of how many values the
source appears to contain. It passes the retained source unchanged to a separate
value parser, which owns all value-syntax decisions.

The 16 MiB and 1,024 defaults bound individual records and nested structural
state without imposing a whole-stream limit. Applications may configure stricter
nonzero limits for their input environment. `push_some` permits a consumer to
pause on each completed frame and resume from the returned consumed-byte count;
`feed` processes the full chunk synchronously without retaining a frame batch.
Cancellation, failure, and reset discard record and delimiter buffers and
release their capacities.

## Why this design

Line framing alone cannot represent multiline containers, while whole-stream
buffering would retain prior records and make memory grow with total input.
Tracking only lexical and delimiter state allows the framer to identify
boundaries, preserve source provenance, and bound internal memory without
pretending to implement or validate the still-separate value grammar.

## Compiled ModuleDeclaration artifacts

Compiled ModuleDeclarations on disk use the data codec. The file extension for
that form is **`.uff.ast`**: one newline-framed codec record under
`<outDir>/ast/<path>.uff.ast` for each `<root>/<path>.uff` source. See
[output directory](./languages/project-file.spec.md#output-directory) and
[AST artifact contracts](./languages/cli/compile-and-stream.spec.md#ast-artifact-contracts).

During migration, compile also writes a JSON sibling (`<path>.uff.ast.json`).
Resolvers prefer `.uff.ast` and fall back to `.uff.ast.json` for compatibility
with JSON-only dependencies. Product builds MUST embed unmodified `.uff.ast`
records directly, decoded without loading languages or resolving other
artifacts. A declaration artifact MUST contain exactly one record; trailing
records or malformed input MUST fail. Removing JSON emission is a separate
compatibility change, not part of codec-first loading and embedding. Fallback
MUST NOT hide invalid codec bytes or declarations behind a JSON sibling.
Registry artifacts present in a package manifest MUST surface integrity and
download failures.

## Open questions

Binary (non-text) codec encoding remains deferred. Text codec value parsing,
native reconstruction, encoding, and ModuleDeclaration `.uff.ast` adoption are
in scope for the current runtime.

## Standalone library

The strict native codec MUST be reusable as `uffda-codec` without the Uffda
runtime, language loader, resolver or collector. Owned documents and lossless
strings belong to this layer; runtime arena conversion belongs in adapters. The
standalone reader MUST expose structured byte positions for decode errors. The
single-value API MUST accept exactly one value with surrounding trivia, and
canonical serialization MUST omit the stream-record newline.

There is one format: fixed tags, strict syntax and no custom converters,
arbitrary construction hooks or permissive modes. Low-level resource limits and
pretty printing MAY be exposed without changing the value contract.
