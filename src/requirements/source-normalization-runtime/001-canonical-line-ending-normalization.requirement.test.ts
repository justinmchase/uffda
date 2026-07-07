import { assertEquals } from "@std/assert";
import { normalizeSource } from "../../lang/source-normalization/mod.ts";

Deno.test("req:source-normalization-runtime-001 - Source normalization canonicalizes line endings and preserves offset provenance", () => {
  const doc = normalizeSource("a\r\nb\rc\n");

  assertEquals(doc.text, "a\nb\nc\n");
  assertEquals(doc.normalizationMap, [0, 1, 3, 4, 5, 6, 7]);
  assertEquals([...doc], ["a", "\n", "b", "\n", "c", "\n"]);
});
