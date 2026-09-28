# Runtime value provenance

**Status: PROPOSED.** This chapter is a design proposal under review in
[#219](https://github.com/justinmchase/uffda/issues/219). It is not yet
normative and no implementation conforms to it. Once accepted, the chapters
listed under [Affected chapters](#affected-chapters) MUST be updated in the same
change that implements it.

This chapter defines how every runtime value retains a link to the Match that
produced it, so source provenance survives any language layer, projection, or
pipeline stage without language-specific knowledge in the runtime.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Logical purpose

Spans live on Matches, never on values
([tokenization](../languages/tokenization.spec.md#structured-tokens-and-trivia)).
When a projection turns matched values into new values, and a later stage
consumes those values as its input stream, nothing links a stage input item back
to the Match that produced it. A primitive value (a string or number) has no
identity, so one `"rule"` cannot be distinguished from another.

Today the runtime rebuilds that link after the fact by walking the tokenizer's
Match tree for values shaped like tokenizer tokens (`structured.ts`). That
couples the generic `pipeline` pattern to one language's output format, only
works for that format, and silently falls back when its count heuristic fails.
Any other language that emits plain strings or numbers has no way to keep
provenance at all.

This chapter replaces that with a single general mechanism: values are carried
inside runtime-owned wrappers that reference their producing Match.

## Terms

- **Raw value:** an ordinary JavaScript value as authors and hosts understand it
  (string, number, boolean, `null`, `undefined`, array, object, function, and so
  on).
- **Wrapped value:** a runtime-owned record pairing a raw value with its
  **origin**.
- **Origin:** the Match that produced the wrapped value. A wrapped value's
  source provenance is its origin's normalized and original source spans.
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
- A wrapped value MUST reference its origin Match rather than copying spans.
  Matches are already retained by the Match graph, so a wrapped value adds only
  the wrapper itself.
- Wrapped values MUST be immutable. The same wrapped value MAY appear in many
  places (bindings, containers, stream items); identity of the wrapper is how
  provenance is shared.
- Wrapped values MUST NOT be observable to `.uff` authors. No pattern,
  expression, or global result MAY expose the wrapper, the origin, or any span
  as an ordinary value. This preserves the rule that expressions never read
  spans.

## Observe raw, carry wrapped

The single rule governing every runtime operation: **values are observed raw and
carried wrapped.**

### Operations that carry (the wrapper passes through unchanged)

- Binding a value to a variable, and reading that variable (`x`, `_`, `this`).
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
  are the wrapped elements.

### Operations that observe (the raw value is inspected)

- Pattern tests: equality, type, character class, regular expression, range, and
  `switch` key comparison MUST compare raw values. Object patterns MUST test raw
  shape but bind wrapped property values.
- Expression operators that compute (arithmetic, comparison, logical operators,
  string interpolation) MUST operate on raw values.
- Memo keys and resolved rule arguments MUST be derived from raw values, so
  wrapping never changes memoization behavior.
- Equality MUST be raw and deep where it is deep today: two wrapped values with
  equal raw values are equal regardless of origin.

### Computed values

- A value newly created by an operation that observes (rather than one carried)
  MUST be wrapped with the origin of the innermost Match whose evaluation
  created it:
  - in a projection expression, the projection's Match;
  - in a func body, the func invocation's argument Match, whose span is derived
    from the provenance of the arguments it consumed;
  - for a literal written in an expression, the Match evaluating that
    expression.
- A Match over an input stream of wrapped items MUST derive its source spans
  from the origins of the items it consumed: the original span of a Match that
  consumed items `a` through `b` runs from the start of item `a`'s origin span
  to the end of item `b`'s origin span. This supersedes per-stream `itemSpans`.

## Globals

- Globals receive and return values under the same data model; there is no
  marker, flag, or metadata that changes how a particular global is treated.
- A global that only rearranges values (for example `map`, `filter`, `flat`,
  `slice`, `at`, `last`, `pack`, `coalesce`) MUST carry the wrapped values it
  moves, so selection and reordering keep provenance. Callbacks MUST receive the
  wrapped element.
- A global that computes (for example `add`, `join`, `format`, `eq`) MUST
  observe raw inputs. A raw value it returns MUST be wrapped with the origin of
  the Match evaluating the invocation.
- The runtime MUST provide explicit, exported helpers for globals to observe and
  to carry values (at minimum: read the raw value of a wrapped value, deeply
  unwrap a value, and test whether a value is wrapped). Globals MUST NOT inspect
  origins.

## Host boundary

- Top-level entry points that return values to host code (grammar execution,
  module resolution, `compile` output, CLI and JSON output) MUST return raw
  values, deeply unwrapped.
- Tooling that needs provenance (diagnostics, language server, MCP) MUST obtain
  it through an explicit runtime API over Matches or wrapped values, never by
  inspecting value shapes.
- Values supplied by the host (globals, input items, `Input.From` values) that
  arrive unwrapped MUST be wrapped on entry. Input items without an upstream
  origin get the Match that consumed them as their origin.

## Invariants

- **Language independence:** the runtime MUST NOT contain knowledge of any
  language's value shapes to compute provenance. `src/runtime` MUST NOT import
  from `src/lang`.
- **Transparency:** for every grammar, the raw values produced, the input
  consumed, and the match outcome MUST be identical to the unwrapped model.
  Wrapping only adds provenance.
- **No loss at stage boundaries:** a value that is carried across `pipeline` and
  `into` boundaries MUST keep its origin, so diagnostics in a later stage
  resolve to authored source offsets through the chain of origins.

## Performance intent

- A wrapped value SHOULD be a single small object of one shape (raw value and
  origin reference) so property access stays monomorphic.
- Implementations SHOULD avoid wrapping values that are discarded without being
  carried (for example intermediate values inside a single computing
  expression), provided the transparency invariant holds.
- Before adoption, parse time and retained heap for `src/lang/source/mod.uff`
  MUST be benchmarked against the unwrapped model and reported on #219.

## Worked example: tokenizer to parser

```
rule WordToken = WordChar+ -> { kind: "word", text: (join (flat _) "") };
func TokenText<{text: t:string}> = t;
rule TokenizerNoWhitespace = Tokenizer -> (semantic_no_whitespace_texts _);
rule UffdaLang = Source |> [TokenizerNoWhitespace] |> [ModuleBody];
```

1. `join` computes a new string, which is wrapped with the origin of
   `WordToken`'s projection Match: exactly that word's source span. The object
   literal carries it as its `text` property.
2. `filter` and `map` carry the token objects without inspecting their origins.
3. `TokenText` destructures its argument, so `t` is the existing wrapped `text`
   value with the word's span.
4. The pipeline builds `ModuleBody`'s input from those wrapped strings. When
   `ModuleBody` fails at item 3, the failure's span derives from item 3's
   origin, which is the authored word, with no tokenizer knowledge in the
   runtime.

## Affected chapters

On acceptance, the following MUST be updated in the implementing change:

- [pipeline](../patterns/runtime/pipeline.spec.md#source-provenance) and
  [into](../patterns/runtime/into.spec.md#source-provenance): derive stream item
  provenance from wrapped values; remove `itemSpans`-specific wording.
- [input model](../patterns/input-model.spec.md): stream items are wrapped
  values; host-supplied items are wrapped on entry.
- [tokenization](../languages/tokenization.spec.md): per-token spans come from
  value origins; no runtime knowledge of token kinds.
- [expression runtime semantics](../expressions/runtime-semantics.spec.md): the
  observe/carry rule for operators, literals, member access, and invocation.
- [value metadata](./value-metadata.spec.md): globals contract for wrapped
  arguments and results.
- Requirements `tokenizer-runtime-002`, `tokenizer-runtime-003`,
  `tokenizer-runtime-007`, and `patterns-runtime/pipeline-001`.

## Open questions

1. **Globals contract for host-supplied globals.** Should host globals receive
   wrapped values (uniform, but every host global must use the helpers), or
   receive raw values with results wrapped at the invocation's origin (simpler
   for hosts, but provenance is lost through them)?
2. **Character provenance inside strings.** When a string value becomes a
   character stream (for example string interpolation re-parsing), should each
   character map linearly from the string origin's start, or should all
   characters share the string's origin span? Linear mapping is only correct
   when the string is a verbatim slice of its origin's input.
3. **Public `Match.value`.** Should `MatchOk.value` on the public API stay raw
   (unwrapped at entry points, with provenance available through a separate
   accessor), or expose wrapped values to tooling directly?
4. **Normalization map.** Source normalization's `normalizationMap` maps
   normalized offsets to original offsets within one source. It is a separate
   concern from value origins and is expected to remain; confirm it should not
   be folded into this mechanism.
