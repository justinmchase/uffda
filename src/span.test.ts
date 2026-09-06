import { assertEquals } from "@std/assert";
import { Input, InputNormalizationMode } from "./input.ts";
import { sourceSpansFrom } from "./span.ts";
import { Scope } from "./runtime/scope.ts";

Deno.test("span.sourceSpansFrom maps itemSpans at pre-item leaf 0", () => {
  const itemSpans = [
    {
      normalized: { start: 0, end: 1 },
      original: { start: 10, end: 11 },
    },
    {
      normalized: { start: 1, end: 2 },
      original: { start: 11, end: 12 },
    },
  ];
  const stream = Input.From(["a", "!"], {
    kind: InputNormalizationMode.Iterable,
    provenance: { itemSpans },
  });
  const start = Scope.From(stream);
  assertEquals(sourceSpansFrom(start, start), {
    normalizedSpan: { start: 0, end: 0 },
    originalSpan: { start: 10, end: 10 },
  });
});

Deno.test("span.sourceSpansFrom maps a consumed item through adjacent leaves", () => {
  const itemSpans = [
    {
      normalized: { start: 0, end: 1 },
      original: { start: 10, end: 11 },
    },
    {
      normalized: { start: 1, end: 2 },
      original: { start: 11, end: 12 },
    },
  ];
  const stream = Input.From(["a", "!"], {
    kind: InputNormalizationMode.Iterable,
    provenance: { itemSpans },
  });
  const before = stream;
  const atFirst = stream.next();
  assertEquals(sourceSpansFrom(Scope.From(before), Scope.From(atFirst)), {
    normalizedSpan: { start: 0, end: 1 },
    originalSpan: { start: 10, end: 11 },
  });
});

Deno.test("span.sourceSpansFrom uses eof endpoints without advancing", () => {
  const itemSpans = [
    {
      normalized: { start: 0, end: 3 },
      original: { start: 8, end: 11 },
    },
  ];
  const stream = Input.From(["abc"], {
    kind: InputNormalizationMode.Iterable,
    provenance: { itemSpans },
  });
  const after = stream.next();
  const eof = after.next();
  assertEquals(eof.isEof, true);
  const start = Scope.From(eof);
  assertEquals(sourceSpansFrom(start, start), {
    normalizedSpan: { start: 3, end: 3 },
    originalSpan: { start: 11, end: 11 },
  });
});

Deno.test("span.sourceSpansFrom falls back to normalizationMap", () => {
  const stream = Input.From("ab", {
    kind: InputNormalizationMode.Scalar,
    provenance: { normalizationMap: [5, 6, 7] },
  });
  const atValue = stream.next();
  const start = Scope.From(stream);
  const end = Scope.From(atValue);
  assertEquals(sourceSpansFrom(start, end), {
    normalizedSpan: { start: 0, end: 1 },
    originalSpan: { start: 5, end: 6 },
  });
});
