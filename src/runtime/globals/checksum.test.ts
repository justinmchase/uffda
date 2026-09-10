import { assertEquals, assertThrows } from "@std/assert";
import { checksum } from "./checksum.ts";
import { document_id } from "./document_id.ts";
import { normalization_map, normalized_unit } from "./normalized_unit.ts";
import { source_document } from "./source_document.ts";
import { units } from "./units.ts";

Deno.test("std.checksum is stable for fixed text", () => {
  assertEquals(checksum(""), "811c9dc5");
  assertEquals(checksum("a"), checksum("a"));
  assertEquals(checksum("hello"), "4f9f2cab");
});

Deno.test("std.document_id uses length and checksum", () => {
  assertEquals(document_id("hi"), `source:2:${checksum("hi")}`);
});

Deno.test("std.normalized_unit and normalization_map", () => {
  const u0 = normalized_unit("a", 0, 1);
  const u1 = normalized_unit("\n", 1, 3);
  assertEquals(u0, {
    value: "a",
    originalOffsetStart: 0,
    originalOffsetEnd: 1,
  });
  assertEquals(normalization_map([u0, u1]), [0, 1, 3]);
  assertEquals(normalization_map([]), [0]);
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

Deno.test("std.source_document is iterable over text", () => {
  const text = "xy";
  const starts = [0];
  const map = [0, 1, 2];
  const doc = source_document(text, starts, units(text, starts, map), map);
  assertEquals(doc.documentId, document_id(text));
  assertEquals([...doc], ["x", "y"]);
});

Deno.test("std.checksum rejects non-strings", () => {
  assertThrows(() => checksum(1 as unknown as string), TypeError);
});
