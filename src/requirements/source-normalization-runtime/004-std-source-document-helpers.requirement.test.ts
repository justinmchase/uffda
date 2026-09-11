import { assertEquals } from "@std/assert";
import { checksum } from "../../runtime/globals/checksum.ts";
import { normalizeSource } from "../../lang/source/mod.ts";
import { collect } from "../../testing.ts";

Deno.test(
  "req:source-normalization-runtime-004 - std helpers assemble SourceDocument indexes",
  async () => {
    assertEquals(checksum(""), "811c9dc5");
    assertEquals(checksum("hello"), "4f9f2cab");

    // SourceDocument assembly now lives in src/lang/source/mod.uff (computed
    // object keys + the generic `iterable` global), not a TS constructor.
    // `document_id` is a module-local .uff func in that file (length +
    // checksum via string interpolation), not a TS global.
    const doc = await normalizeSource("a\nb");

    assertEquals(
      doc.documentId,
      `source:${doc.text.length}:${checksum(doc.text)}`,
    );
    assertEquals(doc.lineStarts, [0, 2]);
    assertEquals(doc.units.length, 3);
    assertEquals(await collect(doc), ["a", "\n", "b"]);
  },
);
