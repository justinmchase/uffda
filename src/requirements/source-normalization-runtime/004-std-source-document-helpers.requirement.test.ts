import { assertEquals } from "@std/assert";
import { checksum } from "../../runtime/globals/checksum.ts";
import { document_id } from "../../runtime/globals/document_id.ts";
import { normalizeSource } from "../../lang/source/mod.ts";
import { collect } from "../../testing.ts";

Deno.test(
  "req:source-normalization-runtime-004 - std helpers assemble SourceDocument indexes",
  async () => {
    assertEquals(checksum(""), "811c9dc5");
    assertEquals(checksum("hello"), "4f9f2cab");

    // SourceDocument assembly now lives in src/lang/source/mod.uff (computed
    // object keys + the generic `iterable` global), not a TS constructor.
    const doc = await normalizeSource("a\nb");

    assertEquals(doc.documentId, document_id(doc.text));
    assertEquals(doc.lineStarts, [0, 2]);
    assertEquals(doc.units.length, 3);
    assertEquals(await collect(doc), ["a", "\n", "b"]);
  },
);
