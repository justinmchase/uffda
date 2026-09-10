import { assertEquals } from "@std/assert";
import { checksum } from "../../runtime/std/checksum.ts";
import { document_id } from "../../runtime/std/document_id.ts";
import { line_starts } from "../../runtime/std/line_starts.ts";
import {
  normalization_map,
  normalized_unit,
} from "../../runtime/std/normalized_unit.ts";
import { source_document } from "../../runtime/std/source_document.ts";
import { units } from "../../runtime/std/units.ts";

Deno.test("req:source-normalization-runtime-004 - std helpers assemble SourceDocument indexes", () => {
  assertEquals(checksum(""), "811c9dc5");
  assertEquals(checksum("hello"), "4f9f2cab");

  const text = "a\nb";
  const starts = line_starts(text);
  const map = normalization_map([
    normalized_unit("a", 0, 1),
    normalized_unit("\n", 1, 2),
    normalized_unit("b", 2, 3),
  ]);
  const rows = units(text, starts, map);
  const doc = source_document(text, starts, rows, map);

  assertEquals(doc.documentId, document_id(text));
  assertEquals(doc.lineStarts, [0, 2]);
  assertEquals(rows.length, 3);
  assertEquals([...doc], ["a", "\n", "b"]);
});
