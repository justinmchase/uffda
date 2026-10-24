import { assertEquals, assertThrows } from "@std/assert";
import { decodeMethodology, median } from "./data-codec.report.ts";

Deno.test("native report identifies the actual decoder and excludes arena timing", () => {
  assertEquals(
    decodeMethodology,
    "Decode: grammar-independent native codec parser to DataDocument; JSON/JSONL serde_json to Value. Encode: prepared DataDocument or JSON Value. Native materialization/GC roundtrip is verified separately, not included in timed decode.",
  );
});

Deno.test("report medians preserve samples and reject invalid measurements", () => {
  const values = [3, 1, 2];
  assertEquals(median(values), 2);
  assertEquals(values, [3, 1, 2]);
  assertEquals(median([4, 1, 3, 2]), 2.5);
  for (const invalid of [[], [-1], [NaN], [Infinity]]) {
    assertThrows(() => median(invalid));
  }
});
