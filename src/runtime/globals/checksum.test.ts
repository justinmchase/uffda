import { assertEquals, assertThrows } from "@std/assert";
import { checksum } from "./checksum.ts";
import { units } from "./units.ts";

Deno.test("std.checksum is stable for fixed text", () => {
  assertEquals(checksum(""), "811c9dc5");
  assertEquals(checksum("a"), checksum("a"));
  assertEquals(checksum("hello"), "4f9f2cab");
});

Deno.test("std.units builds SourceUnit rows", () => {
  const text = "a\n";
  const map = [0, 1, 2];
  const starts = [0, 2];
  const rows = units(text, starts, map);
  assertEquals(rows.length, 2);
  assertEquals(rows[0].value, "a");
  assertEquals(rows[0].lineStart, 1);
  assertEquals(rows[0].columnStart, 1);
  assertEquals(rows[1].value, "\n");
  assertEquals(rows[1].originalOffsetStart, 1);
});

Deno.test("std.checksum rejects non-strings", () => {
  assertThrows(() => checksum(1 as unknown as string), TypeError);
});
