---
id: data-codec-001
title: Incremental byte framing emits bounded raw value records
spec_ref: ".agents/specifications/data-codec.spec.md#record-boundaries-and-lexical-structure; .agents/specifications/data-codec.spec.md#incremental-operation-spans-and-limits"
---

# Incremental data record framing

## Requirement

Preconditions:

- A caller creates a framer with nonzero maximum record-byte and nesting-depth
  limits, or uses the defaults of 16 MiB and 1,024.
- The caller supplies source bytes in any sequence of chunks.

Expected behavior:

- The framer MUST emit one raw UTF-8 frame for each physical record, separated
  by LF outside strings and containers; EOF MUST emit the final record even
  without LF. The value parser, not framing, determines whether the record
  contains exactly one valid value.
- Blank and comment-only lines MUST emit no frames. Comments MUST end at the
  physical LF, and `#` inside a quoted string MUST remain source text.
- Multiline arrays and objects MUST remain one frame, and nested delimiters MUST
  match in stack order. Escaped quotes MUST NOT close strings.
- Invalid UTF-8, an unterminated string, a mismatched or unfinished delimiter,
  or an exceeded configured limit MUST fail explicitly with the relevant
  absolute byte offset. The framer MUST preserve source that may contain
  multiple values on one physical line for the value parser to diagnose.
- Every frame MUST preserve its raw source and report a half-open byte span
  beginning at the first retained record byte and ending before its top-level
  LF.
- Splitting input at any byte boundary MUST produce the same frames and errors
  as supplying it in one chunk.
- The framer MUST retain at most the current record up to its configured byte
  limit, nesting state up to its configured depth limit, and fixed-size UTF-8
  carry state. It MUST NOT retain previously emitted frames.
- A framing error or cancellation MUST prevent further feed until reset. Finish
  MUST close the stream; feed and repeated finish MUST fail until reset. Reset
  MUST clear prior stream state and restart offsets at zero. Cancellation,
  framing failure, and reset MUST release record and delimiter-buffer
  capacities. Byte-offset overflow MUST fail explicitly without wrapping or
  saturating source offsets.
- A bounded push operation MUST report the number of input bytes consumed when
  the consumer pauses after a delivered frame, so the caller can resume with the
  unconsumed suffix without the framer retaining an output batch.
- The framer MUST return source frames only. It MUST NOT validate the complete
  value grammar, construct decoded values, or evaluate expressions.

Postconditions:

- Each delivered frame can be passed unchanged to a separate data-value parser
  with its original byte provenance recoverable from the frame span.
- Tests: inline tests in `src/codec_runtime/mod.rs`.
