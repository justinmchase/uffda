import { assertEquals } from "@std/assert";
import { buildLineStarts, normalizeSource, normalizeText } from "./mod.ts";

Deno.test("lang.source-normalization - normalizes CRLF and CR into LF", () => {
  const normalized = normalizeText("a\r\nb\rc\n");

  assertEquals(normalized.text, "a\nb\nc\n");
  assertEquals(normalized.normalizationMap, [0, 1, 3, 4, 5, 6, 7]);
});

Deno.test("lang.source-normalization - computes deterministic source document", () => {
  const one = normalizeSource("ab\r\nc");
  const two = normalizeSource("ab\r\nc");

  assertEquals(one.documentId, two.documentId);
  assertEquals(one.text, "ab\nc");
  assertEquals(one.lineStarts, [0, 3]);
  assertEquals([...one], ["a", "b", "\n", "c"]);
  assertEquals(one.units.length, 4);

  assertEquals(one.units[0].offsetStart, 0);
  assertEquals(one.units[0].offsetEnd, 1);
  assertEquals(one.units[0].lineStart, 1);
  assertEquals(one.units[0].columnStart, 1);
  assertEquals(one.units[0].originalOffsetStart, 0);

  const newline = one.units[2];
  assertEquals(newline.value, "\n");
  assertEquals(newline.lineStart, 1);
  assertEquals(newline.columnStart, 3);
  assertEquals(newline.originalOffsetStart, 2);
});

Deno.test("lang.source-normalization - line starts include trailing empty line", () => {
  assertEquals(buildLineStarts("a\n"), [0, 2]);
});
