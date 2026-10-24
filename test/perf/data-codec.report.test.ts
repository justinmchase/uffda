import { assert, assertEquals, assertThrows } from "@std/assert";
import baseline from "./data-codec-native-baseline.json" with { type: "json" };
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

Deno.test("retained native baseline covers every pipeline with valid timed samples", () => {
  assertEquals(baseline.methodology[1], decodeMethodology);
  assertEquals(baseline.sizes.length, 12);
  assertEquals(baseline.samples.length, 216);
  for (
    const workload of [
      "ordinary",
      "unicode-text",
      "nested",
      "native-tagged",
    ]
  ) {
    for (const format of ["codec", "json", "jsonl"]) {
      for (const compression of ["raw", "gzip"]) {
        for (const operation of ["baseline", "encode", "decode"]) {
          const samples = baseline.samples.filter((sample) =>
            sample.workload === workload && sample.format === format &&
            sample.compression === compression &&
            sample.operation === operation
          );
          assertEquals(samples.length, 3);
          for (const sample of samples) {
            assert(sample.peakRssKiB > 0);
            if (operation !== "baseline") {
              assert(sample.records >= 256);
              assert(sample.elapsedMs >= 100);
              assert(sample.bytes > 0);
            }
          }
        }
      }
    }
  }
  assertEquals(baseline.memoryScaling.length, 24);
  for (const workload of ["ordinary", "native-tagged"]) {
    for (const format of ["codec", "json", "jsonl"]) {
      for (const compression of ["raw", "gzip"]) {
        for (const records of [32, 4096]) {
          const samples = baseline.memoryScaling.filter((sample) =>
            sample.workload === workload && sample.format === format &&
            sample.compression === compression && sample.records === records
          );
          assertEquals(samples.length, 1);
          assert(samples[0].peakRssKiB > 0);
          assert(samples[0].elapsedMs > 0);
        }
      }
    }
  }
});
