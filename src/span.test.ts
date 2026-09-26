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

Deno.test("span.sourceSpansFrom maps a consumed item through adjacent leaves", async () => {
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
  const atFirst = await stream.next();
  assertEquals(sourceSpansFrom(Scope.From(before), Scope.From(atFirst)), {
    normalizedSpan: { start: 0, end: 1 },
    originalSpan: { start: 10, end: 11 },
  });
});

Deno.test("span.sourceSpansFrom starts a later match at its first item", async () => {
  // Items separated by dropped trivia: "import" at 0..6, '"' at 7..8.
  const itemSpans = [
    {
      normalized: { start: 0, end: 6 },
      original: { start: 0, end: 6 },
    },
    {
      normalized: { start: 7, end: 8 },
      original: { start: 7, end: 8 },
    },
    {
      normalized: { start: 8, end: 9 },
      original: { start: 8, end: 9 },
    },
  ];
  const stream = Input.From(["import", '"', "."], {
    kind: InputNormalizationMode.Iterable,
    provenance: { itemSpans },
  });
  const afterFirst = await stream.next();
  const afterSecond = await afterFirst.next();
  assertEquals(
    sourceSpansFrom(Scope.From(afterFirst), Scope.From(afterSecond)),
    {
      normalizedSpan: { start: 7, end: 8 },
      originalSpan: { start: 7, end: 8 },
    },
  );
  const at = Scope.From(afterFirst);
  assertEquals(sourceSpansFrom(at, at), {
    normalizedSpan: { start: 7, end: 7 },
    originalSpan: { start: 7, end: 7 },
  });
});

Deno.test("span.sourceSpansFrom uses eof endpoints without advancing", async () => {
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
  const after = await stream.next();
  const eof = await after.next();
  assertEquals(eof.isEof, true);
  const start = Scope.From(eof);
  assertEquals(sourceSpansFrom(start, start), {
    normalizedSpan: { start: 3, end: 3 },
    originalSpan: { start: 11, end: 11 },
  });
});

Deno.test("span.sourceSpansFrom falls back to normalizationMap", async () => {
  const stream = Input.From("ab", {
    kind: InputNormalizationMode.Scalar,
    provenance: { normalizationMap: [5, 6, 7] },
  });
  const atValue = await stream.next();
  const start = Scope.From(stream);
  const end = Scope.From(atValue);
  assertEquals(sourceSpansFrom(start, end), {
    normalizedSpan: { start: 0, end: 1 },
    originalSpan: { start: 5, end: 6 },
  });
});
