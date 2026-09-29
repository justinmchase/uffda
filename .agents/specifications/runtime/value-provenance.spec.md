# Runtime value provenance

**Status: ACCEPTED.** Adopted for
[#219](https://github.com/justinmchase/uffda/issues/219). The chapters listed
under [Related chapters](#related-chapters) conform to it.

This chapter defines how every runtime value retains a link to where it came
from, so errors can be traced back to precise positions in the input the caller
supplied, through any language layer, projection, or pipeline stage, without
language-specific knowledge in the runtime.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

The caller supplies an input and needs to know, as precisely as possible, where
in that input a problem lies. Spans live on Matches, never on values
([tokenization](../languages/tokenization.spec.md#structured-tokens-and-trivia)).
When a projection turns matched values into new values, and a later stage
consumes those values as its input stream, nothing links a stage input item back
to the Match that produced it. A primitive value (a string or number) has no
identity, so one `"rule"` cannot be distinguished from another.

Before this chapter, the runtime worked around this in two language-specific
ways:

- The `pipeline` pattern rebuilt per-item spans by walking the tokenizer's Match
  tree for values shaped like tokenizer tokens. It only worked for that format
  and silently fell back when its count heuristic failed.
- Source normalization built an offset table in `.uff` by reading the current
  Match's span in rule expressions, and the runtime picked it up by recognizing
  values shaped like a `SourceDocument`.

Both are the same problem: a computed value lost the link to the input it came
from. Any other language that emits plain strings or numbers has no way to keep
provenance at all. This chapter replaces both workarounds with one general
mechanism: values are carried inside runtime-owned wrappers that reference their
origin.

## Terms

- **Raw value:** an ordinary JavaScript value as authors and hosts understand it
  (string, number, boolean, `null`, `undefined`, array, object, function, and so
  on).
- **Wrapped value:** a runtime-owned record pairing a raw value with its
  **origin**.
- **Origin:** where a wrapped value came from, as a source span. For a value
  produced during matching it is the source span of the Match that produced the
  value; for a value supplied by the host as input it is its **root position**
  in that host input. An origin is spans only; it does not reference the Match.
- **Root position:** the location of a host-supplied input item: the character
  offset for a string input, or the item path for an iterable input.
- **Source span:** the range of root positions a value or Match derives from.
  This is what diagnostics report. A Match carries exactly one source span
  (`originalSpan`), in the coordinates of the caller's input.
- **Observe:** to inspect a value's raw content in order to decide something
  (compare it, test its type, compute from it, hash it).
- **Carry:** to move a value from one place to another without inspecting it
  (bind it, return it, store it in a container, pass it as an argument).

## Data model

- Every value produced during pattern matching or expression evaluation MUST be
  a wrapped value.
- Containers MUST be wrapped at every level: an array value is a wrapped value
  whose raw array holds wrapped elements, and an object value is a wrapped value
  whose raw object holds wrapped property values. Per-element and per-property
  provenance depends on this.
- A wrapped value's origin MUST be spans only and MUST NOT reference the Match
  that produced it. A Match retains its scope and memo table, so a Match
  reference would keep whole stages' parse state alive for as long as any value
  derived from them. An origin MAY share the producing Match's span objects.
- Wrapped values MUST be immutable. The same wrapped value MAY appear in many
  places (bindings, containers, stream items); identity of the wrapper is how
  provenance is shared.
- Wrapped values MUST NOT be observable to `.uff` authors. No pattern,
  expression, or global result MAY expose the wrapper or a value's origin as an
  ordinary value.
- A Match's own span stays readable through `this` (see
  [reference](../expressions/reference.spec.md)), and the runtime does not block
  it. Foundational components (runtime mechanisms and the language modules
  shipped with the runtime) MUST NOT rely on reading spans to establish
  provenance; provenance MUST flow through value origins.

## Root input

- Items of a host-supplied input MUST be wrapped on entry with their root
  position as origin. A string input's items are its characters, each with its
  own character offset.
- A host-supplied scalar input's single item is the whole value. When that value
  is a string, its characters take their own offsets (character `k`, counted in
  code points, at `k` to `k + 1`), so iterating it yields root positions.
- A Match's source span MUST be derived from the source spans of the input items
  it consumed: a Match that consumed items `a` through `b` spans from the start
  of item `a`'s source span to the end of item `b`'s source span. A zero-width
  Match (including every failure) is a point: the start of the next item's
  source span when that item has already been read, otherwise the end of the
  previous item's source span, otherwise the start of the stream (the start of
  the origin of the value the stream iterates, or `0` for host input). Computing
  a span MUST NOT advance the stream. This applies uniformly to host input and
  to derived stage inputs; there are no per-stream offset tables.

## Observe raw, carry wrapped

The single rule governing every runtime operation: **values are observed raw and
carried wrapped.**

### Operations that carry (the wrapper passes through unchanged)

- Binding a value to a variable, and reading that variable (`x`, `_`).
- A Match's value when the pattern's value is an input item or a child's value
  (for example `any`, `equal`, `character`, `variable`, `then`, `or`, `and`,
  `maybe`, `over`, `into`, rule references). Consuming an input item yields that
  item's existing wrapped value, so provenance flows across stage boundaries.
- Placing values into array and object literals, including spreads: each element
  or property keeps its own wrapped value.
- Member access and indexing: the result is the stored wrapped property or
  element.
- Parameter destructuring in `func` declarations: func arguments are matched as
  an input stream, so a destructured binding is the argument's existing wrapped
  value (or the wrapped property inside it).
- Returning a bound value from a projection or func body (for example
  `func TokenText<{text: t}> = t`).
- Building a pipeline or `into` input stream from a value: the stream's items
  are the wrapped elements, or, for a string, its characters with their
  character provenance (see
  [String character provenance](#string-character-provenance)).

### Operations that observe (the raw value is inspected)

- Pattern tests: equality, type, character class, regular expression, range, and
  `switch` key comparison MUST compare raw values. Object patterns MUST test raw
  shape but bind wrapped property values.
- Expression operators that compute (arithmetic, comparison, logical operators)
  MUST operate on raw values.
- Memo keys and resolved rule arguments MUST be derived from raw values, so
  wrapping never changes memoization behavior.
- Equality MUST be raw and deep where it is deep today: two wrapped values with
  equal raw values are equal regardless of origin.

### Computed values

- A value newly created by an operation that observes (rather than one carried)
  MUST be wrapped with the source span of the innermost Match whose evaluation
  created it as origin:
  - in a projection expression, the projection's Match;
  - in a func body, the func invocation's argument Match, whose source span is
    derived from the arguments it consumed;
  - for a literal written in an expression, the Match evaluating that
    expression.

## String character provenance

A string often becomes the input of a later stage (for example when an
interpolated string is re-parsed, or when normalized source text is tokenized),
so a single span for the whole string is not precise enough.

- Every character of a wrapped string MUST have its own source span.
- A string taken directly from the input (a single character item) has the
  character's source span.
- A string produced by concatenation (`join`, string interpolation, and any
  other operation that builds a string from strings) MUST give each character
  the source span of the character it was copied from.
- A character written in an expression literal, or produced by a computation
  that does not copy characters, MUST take the source span of the Match that
  created it. For example, normalizing `"\r\n"` to a literal `"\n"` gives that
  `"\n"` the span of both original characters.
- Because a literal takes the span of the whole Match projecting it, grammar
  authors SHOULD bind and carry matched items rather than re-create them as
  literals when the result may be re-parsed (for example
  `o:"(" c:Chunk* e:")" -> (pack o c e)` rather than
  `"(" c:Chunk* ")" -> (pack "(" c ")")`), so each item keeps its own span.
- Implementations SHOULD store character provenance compactly as runs, merging
  adjacent characters whose source spans are contiguous, so a string copied
  verbatim from the input costs one run regardless of length.
- When a string becomes an input stream, each character item MUST carry its own
  character provenance.

With this rule, source normalization needs no offset table: the normalized text
is a concatenation of units, and every unit already carries the span of the
original characters it replaced.

## Globals

- Globals receive and return values under the same data model, host-supplied
  globals included. There is no marker, flag, or metadata that changes how a
  particular global is treated.
- A global that only rearranges values (for example `map`, `filter`, `flat`,
  `slice`, `at`, `last`, `pack`, `coalesce`) MUST carry the wrapped values it
  moves, so selection and reordering keep provenance. Callbacks MUST receive the
  wrapped element.
- A global that computes (for example `add`, `format`, `eq`) MUST observe raw
  inputs. A raw value it returns MUST be wrapped with the source span of the
  Match evaluating the invocation as origin. A global that builds strings from
  strings MUST use the runtime's concatenation helper so character provenance is
  kept.
- The runtime MUST export explicit helpers for globals: read the raw value of a
  wrapped value, deeply unwrap a value, test whether a value is wrapped, and
  concatenate strings with provenance. Globals MUST NOT inspect origins.
- Native expressions (host functions embedded in an expression AST) follow the
  same model as globals: they receive wrapped variables (including `_`), and a
  raw value they return is wrapped with the evaluating Match's source span as
  origin.

## Host boundary

- `Match.value` MUST be the wrapped value. The Match graph has a single value
  representation, and tooling can map any value (for example an AST node or one
  of its properties) back to the caller's input directly.
- Top-level entry points that return plain values to host code (for example
  `compile` output and CLI or JSON output) MUST return raw values, deeply
  unwrapped. Deep unwrapping extends to iteration: iterating an unwrapped value
  (through a plain object's iteration hooks, or an iterator such as a generator)
  yields deeply unwrapped items, while the same value iterated inside the
  runtime yields wrapped items.
- The runtime MUST export an API to read a wrapped value's source span
  (`Wrapped.origin`, and `charOrigin`/`charOrigins` for the characters of a
  string). Tooling that needs provenance (diagnostics, language server, MCP)
  MUST use it, never inspect value shapes.

## Invariants

- **Language independence:** the runtime MUST NOT contain knowledge of any
  language's value shapes to compute provenance. `src/runtime` MUST NOT import
  from `src/lang`.
- **Transparency:** for every grammar, the raw values produced, the input
  consumed, and the match outcome MUST be identical to the unwrapped model.
  Wrapping only adds provenance.
- **No loss at stage boundaries:** a carried value MUST keep its origin across
  `pipeline` and `into` boundaries, so diagnostics in a later stage resolve to
  positions in the caller's input through the chain of origins.

## Performance intent

- A wrapped value SHOULD be a single small object of one shape (raw value and
  origin reference) so property access stays monomorphic.
- Implementations SHOULD avoid wrapping values that are discarded without being
  carried (for example intermediate values inside a single computing
  expression), provided the transparency invariant holds. A named invocation
  target is resolved without wrapping, since it is called rather than carried.
- A wrapped value SHOULD convert like its raw value (`Symbol.toPrimitive`) and
  serialize as its raw value (`toJSON`), so host code that coerces or serializes
  a wrapped value gets the raw result.
- Before adoption, parse time and retained heap for `src/lang/source/mod.uff`
  MUST be benchmarked against the unwrapped model and reported on #219.

## Worked examples

### Tokenizer to parser

```
rule WordToken = WordChar+ -> { kind: "word", text: (join (flat _) "") };
func TokenText<{text: t:string}> = t;
rule TokenizerNoWhitespace = Tokenizer -> (semantic_no_whitespace_texts _);
rule UffdaLang = Source |> [TokenizerNoWhitespace] |> [ModuleBody];
```

1. `join` concatenates the word's characters, so the resulting string keeps each
   character's source span. The object literal carries it as its `text`
   property.
2. `filter` and `map` carry the token objects without inspecting their origins.
3. `TokenText` destructures its argument, so `t` is the existing wrapped `text`
   value.
4. The pipeline builds `ModuleBody`'s input from those wrapped strings. When
   `ModuleBody` fails at item 3, the failure's span is item 3's source span: the
   authored word, with no tokenizer knowledge in the runtime.

### Source normalization

```
rule CrLfUnit = "\r" "\n" -> "\n";
rule CrUnit = "\r" -> "\n";
rule SourceUnit = except "\r";
rule NormalizedText =
  string & [(CrLfUnit | CrUnit | SourceUnit)*]
  -> { kind: "NormalizedText", text: (join _ "") };
```

`CrLfUnit` creates a literal `"\n"` whose span is both original characters, and
`SourceUnit` carries each original character. `join` keeps per-character spans,
so the normalized text maps every character back to the caller's input with no
offset table, no `this.normalizedSpan`, and no `SourceDocument` recognition in
the runtime.

## Related chapters

The following chapters and requirements conform to this chapter:

- [pipeline](../patterns/runtime/pipeline.spec.md#source-provenance) and
  [into](../patterns/runtime/into.spec.md#source-provenance): derive stream item
  provenance from wrapped values; remove `itemSpans`-specific wording.
- [input model](../patterns/input-model.spec.md): stream items are wrapped
  values; host-supplied items are wrapped with root positions on entry.
- [source normalization](../languages/source-normalization.spec.md): per-
  character provenance replaces the normalization map.
- [tokenization](../languages/tokenization.spec.md): per-token spans come from
  value origins; no runtime knowledge of token kinds.
- [debuggability](../languages/debuggability.spec.md): provenance mapping is
  satisfied by value origins.
- [expression runtime semantics](../expressions/runtime-semantics.spec.md): the
  observe/carry rule for operators, literals, member access, and invocation.
- [reference](../expressions/reference.spec.md) and
  [invocation](../expressions/invocation.spec.md): `this` no longer serves span
  access.
- [value metadata](./value-metadata.spec.md): globals contract for wrapped
  arguments and results.
- Requirements `source-normalization-runtime-001`, `tokenizer-runtime-002`,
  `tokenizer-runtime-003`, `tokenizer-runtime-007`, and
  `patterns-runtime/pipeline-001`.

## Resolved design decisions

- **Globals contract:** uniform. Host-supplied globals follow the same wrapped
  data model as default globals; provenance takes priority over host
  convenience.
- **Character provenance:** per character, mapped back to the caller's input
  with maximum precision.
- **Public `Match.value`:** the wrapped value (single representation). Entry
  points that return plain values unwrap them. This MAY be revisited once the
  implementation is complete.
- **Normalization map:** folded into this mechanism. It was a special case of a
  computed string losing its link to the input.
- **Span reads through `this`:** allowed, not blocked. Only foundational
  components are barred from depending on them, so provenance never hinges on
  authors copying spans into values.
- **One span per Match:** Matches and origins carry a single source span in the
  caller's input coordinates. The former separate normalized span described
  offsets in one language's intermediate text (source normalization's), which a
  language-independent runtime cannot compute, and tooling only used the
  original span.
- **Origins are spans, not Matches:** benchmarking showed Match origins kept
  every pipeline stage's memo table alive (4.5x retained heap). Diagnostics need
  where a value came from in the caller's input, not which Match produced it, so
  origins hold spans only.
