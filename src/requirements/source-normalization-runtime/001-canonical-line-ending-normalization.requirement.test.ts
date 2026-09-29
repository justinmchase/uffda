import { assertEquals } from "@std/assert";
import { normalizeSource, sourceMatch } from "../../lang/source/mod.ts";
import { charOrigins, type Wrapped } from "../../wrapped.ts";
import { collect } from "../../testing.ts";

Deno.test("req:source-normalization-runtime-001 - Source normalization canonicalizes line endings and preserves offset provenance", async () => {
  const doc = await normalizeSource("a\r\nb\rc\n");

  assertEquals(doc.text, "a\nb\nc\n");
  assertEquals(await collect(doc), ["a", "\n", "b", "\n", "c", "\n"]);

  const m = await sourceMatch("a\r\nb\rc\n");
  const { text } = m.value.raw as Record<string, Wrapped<string>>;
  assertEquals(charOrigins(text), [
    { start: 0, end: 1 },
    { start: 1, end: 3 },
    { start: 3, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 6 },
    { start: 6, end: 7 },
  ]);
});
