import { assert, assertEquals, assertThrows } from "@std/assert";
import { median } from "./data-codec.report.ts";
import baseline from "./data-codec-baseline.json" with { type: "json" };

Deno.test("req:data-codec-004 - measurements summarize independent samples without accepting invalid timing", () => {
  assertEquals(median([9, 2, 4]), 4);
  assertEquals(median([9, 2, 4, 3]), 3.5);
  assertEquals(median([0]), 0);
  for (const values of [[], [NaN], [-1], [Infinity]]) {
    assertThrows(() => median(values), Error, "samples");
  }
});

Deno.test("req:data-codec-004 - persistent baseline contains every transport/pipeline and sufficiently long samples", () => {
  assertEquals(baseline.sizes.length, 12);
  assertEquals(baseline.samples.length, 216);
  assertEquals(baseline.memoryScaling.length, 24);
  for (
    const workload of ["ordinary", "unicode-text", "nested", "native-tagged"]
  ) {
    for (const format of ["codec", "json", "jsonl"]) {
      const sizes = baseline.sizes.filter((row) =>
        row.workload === workload && row.format === format
      );
      assertEquals(sizes.length, 1);
      assert(sizes[0].rawBytes > 0 && sizes[0].gzipBytes > 0);
      for (const compression of ["raw", "gzip"]) {
        for (const operation of ["encode", "decode", "baseline"]) {
          const samples = baseline.samples.filter((row) =>
            row.workload === workload && row.format === format &&
            row.compression === compression && row.operation === operation
          );
          assertEquals(samples.length, 3);
          for (const sample of samples) {
            assert(sample.peakRssKiB > 0);
            assertEquals(sample.chunkBytes, 4096);
            if (operation === "baseline") {
              assertEquals(sample.records, 0);
            } else {
              assert(
                sample.elapsedMs >= 100 && sample.bytes > 0 &&
                  sample.records >= 256,
              );
              assertEquals(sample.records % 32, 0);
            }
          }
        }
        if (["ordinary", "native-tagged"].includes(workload)) {
          const scaling = baseline.memoryScaling.filter((row) =>
            row.workload === workload && row.format === format &&
            row.compression === compression
          );
          assertEquals(scaling.map((row) => row.records), [32, 4096]);
        }
      }
    }
  }
});
