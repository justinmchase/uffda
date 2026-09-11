import { assertEquals } from "@std/assert";
import { sha256 } from "../../runtime/globals/sha256.ts";
import { base58 } from "../../runtime/globals/base58.ts";
import { slice } from "../../runtime/globals/slice.ts";
import { normalizeSource } from "../../lang/source/mod.ts";
import { collect } from "../../testing.ts";

Deno.test(
  "req:source-normalization-runtime-004 - std helpers assemble SourceDocument indexes",
  async () => {
    // SourceDocument assembly now lives in src/lang/source/mod.uff (computed
    // object keys + the generic `iterable` global), not a TS constructor.
    // `document_id` is a module-local .uff func in that file (length +
    // sha256/base58/slice via string interpolation), not a TS global.
    const doc = await normalizeSource("a\nb");

    const expectedDigest = slice(base58(await sha256(doc.text)), 0, 8);
    assertEquals(doc.documentId, `source:${doc.text.length}:${expectedDigest}`);
    assertEquals(doc.lineStarts, [0, 2]);
    assertEquals(doc.units.length, 3);
    assertEquals(await collect(doc), ["a", "\n", "b"]);
  },
);
