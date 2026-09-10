import { assertEquals } from "@std/assert";
import { checksum } from "../../runtime/globals/checksum.ts";
import { document_id } from "../../runtime/globals/document_id.ts";
import { source_document } from "../../runtime/globals/source_document.ts";
import { units } from "../../runtime/globals/units.ts";

Deno.test("req:source-normalization-runtime-004 - std helpers assemble SourceDocument indexes", () => {
  assertEquals(checksum(""), "811c9dc5");
  assertEquals(checksum("hello"), "4f9f2cab");

  const text = "a\nb";
  const starts = [0, 2];
  // normalized_unit/normalization_map moved into src/lang/source/mod.uff as
  // module-local funcs; the equivalent normalizationMap for these units is
  // inlined here (starts of each unit, plus the last unit's end offset).
  const map = [0, 1, 2, 3];
  const rows = units(text, starts, map);
  const doc = source_document(text, starts, rows, map);

  assertEquals(doc.documentId, document_id(text));
  assertEquals(doc.lineStarts, [0, 2]);
  assertEquals(rows.length, 3);
  assertEquals([...doc], ["a", "\n", "b"]);
});
