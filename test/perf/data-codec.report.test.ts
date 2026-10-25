import {
  deepStrictEqual,
  ok,
  rejects,
  strictEqual,
  throws,
} from "node:assert/strict";
import test from "node:test";
import baseline from "./data-codec-native-baseline.json" with { type: "json" };
import { decodeMethodology, gzip, median } from "./data-codec.report.ts";
import { codecCorpus, transport } from "./data-codec-corpus.ts";

test("req:data-codec-004 - Node gzip preserves every corpus transport and rejects malformed input", async () => {
  for (const workload of codecCorpus()) {
    for (const format of ["codec", "json", "jsonl"]) {
      const bytes = new TextEncoder().encode(transport(workload, format));
      const compressed = await gzip(bytes);
      deepStrictEqual(new Uint8Array(await gzip(compressed, true)), bytes);
      await rejects(gzip(compressed.subarray(0, compressed.length - 1), true));
    }
  }
  await rejects(gzip(new TextEncoder().encode("not gzip"), true));
});

test("req:data-codec-004 - native report identifies the actual decoder and excludes arena timing", () => {
  strictEqual(
    decodeMethodology,
    "Decode: grammar-independent native codec parser to DataDocument; JSON/JSONL serde_json to Value. Encode: prepared DataDocument or JSON Value. Native materialization/GC roundtrip is verified separately, not included in timed decode.",
  );
});

test("req:data-codec-004 - report medians preserve samples and reject invalid measurements", () => {
  const values = [3, 1, 2];
  strictEqual(median(values), 2);
  deepStrictEqual(values, [3, 1, 2]);
  strictEqual(median([4, 1, 3, 2]), 2.5);
  for (const invalid of [[], [-1], [NaN], [Infinity]]) {
    throws(() => median(invalid));
  }
});

test("req:data-codec-004 - retained native baseline covers every pipeline with valid timed samples", () => {
  strictEqual(baseline.methodology[1], decodeMethodology);
  strictEqual(baseline.sizes.length, 12);
  strictEqual(baseline.samples.length, 216);
  for (const workload of [
    "ordinary",
    "unicode-text",
    "nested",
    "native-tagged",
  ]) {
    for (const format of ["codec", "json", "jsonl"]) {
      for (const compression of ["raw", "gzip"]) {
        for (const operation of ["baseline", "encode", "decode"]) {
          const samples = baseline.samples.filter(
            (sample) =>
              sample.workload === workload &&
              sample.format === format &&
              sample.compression === compression &&
              sample.operation === operation,
          );
          strictEqual(samples.length, 3);
          for (const sample of samples) {
            ok(sample.peakRssKiB > 0);
            if (operation !== "baseline") {
              ok(sample.records >= 256);
              ok(sample.elapsedMs >= 100);
              ok(sample.bytes > 0);
            }
          }
        }
      }
    }
  }
  strictEqual(baseline.memoryScaling.length, 24);
  for (const workload of ["ordinary", "native-tagged"]) {
    for (const format of ["codec", "json", "jsonl"]) {
      for (const compression of ["raw", "gzip"]) {
        for (const records of [32, 4096]) {
          const samples = baseline.memoryScaling.filter(
            (sample) =>
              sample.workload === workload &&
              sample.format === format &&
              sample.compression === compression &&
              sample.records === records,
          );
          strictEqual(samples.length, 1);
          ok(samples[0].peakRssKiB > 0);
          ok(samples[0].elapsedMs > 0);
        }
      }
    }
  }
});
