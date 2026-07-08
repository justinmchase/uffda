import { assertEquals } from "@std/assert";
import { normalizeSource } from "../../lang/source-normalization/mod.ts";

Deno.test("req:source-normalization-runtime-002 - Source normalization produces deterministic line and unit indexes covering normalized text", () => {
  const one = normalizeSource("ab\r\nc");
  const two = normalizeSource("ab\r\nc");

  assertEquals(one.documentId, two.documentId);
  assertEquals(one.lineStarts, [0, 3]);
  assertEquals(one.units.length, 4);

  assertEquals(one.units[0].offsetStart, 0);
  assertEquals(one.units[0].offsetEnd, 1);
  assertEquals(one.units[3].offsetStart, 3);
  assertEquals(one.units[3].offsetEnd, 4);
  assertEquals(one.units[3].lineStart, 2);
  assertEquals(one.units[3].columnStart, 1);
});
