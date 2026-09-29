import { assertEquals } from "@std/assert";
import { normalizeSource, sourceMatch } from "./mod.ts";
import { collect } from "../../testing.ts";
import { charOrigins, isWrapped, type Wrapped } from "../../wrapped.ts";

Deno.test("lang.source - normalizes CRLF and CR into LF", async () => {
  const normalized = await normalizeSource("a\r\nb\rc\n");

  assertEquals(normalized.text, "a\nb\nc\n");
});

Deno.test("lang.source - each normalized character maps to the characters it came from", async () => {
  const m = await sourceMatch("a\r\nb\rc\n");
  const { text } = m.value.raw as Record<string, Wrapped<string>>;
  assertEquals(text.raw, "a\nb\nc\n");
  assertEquals(charOrigins(text), [
    { start: 0, end: 1 },
    { start: 1, end: 3 },
    { start: 3, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 6 },
    { start: 6, end: 7 },
  ]);
});

Deno.test("lang.source - computes deterministic source document", async () => {
  const one = await normalizeSource("ab\r\nc");
  const two = await normalizeSource("ab\r\nc");

  assertEquals(one.documentId, two.documentId);
  assertEquals(one.text, "ab\nc");
  assertEquals(one.lineStarts, [0, 3]);
  assertEquals(await collect(one), ["a", "b", "\n", "c"]);
  assertEquals(one.units.length, 4);

  assertEquals(one.units[0].offsetStart, 0);
  assertEquals(one.units[0].offsetEnd, 1);
  assertEquals(one.units[0].lineStart, 1);
  assertEquals(one.units[0].columnStart, 1);

  const newline = one.units[2];
  assertEquals(newline.value, "\n");
  assertEquals(newline.lineStart, 1);
  assertEquals(newline.columnStart, 3);
});

Deno.test("lang.source - line starts include trailing empty line", async () => {
  const normalized = await normalizeSource("a\n");
  assertEquals(normalized.lineStarts, [0, 2]);
});

Deno.test("lang.source - returns a raw document whose iteration yields raw units", async () => {
  const document = await normalizeSource("a\r\nb");
  assertEquals(isWrapped(document.text), false);
  assertEquals(isWrapped(document.units[0]), false);
  const items = await collect(document);
  assertEquals(items.some(isWrapped), false);
  assertEquals(items, ["a", "\n", "b"]);
});
