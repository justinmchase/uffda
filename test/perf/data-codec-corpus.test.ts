import { assertEquals, assertThrows } from "@std/assert";
import { codecCorpus, transport } from "./data-codec-corpus.ts";

Deno.test("req:data-codec-004 - representative corpus is deterministic and JSON comparisons retain native tags", () => {
  const corpus = codecCorpus(2);
  assertEquals(corpus, codecCorpus(2));
  assertEquals(corpus.map((workload) => workload.name), [
    "ordinary",
    "unicode-text",
    "nested",
    "native-tagged",
  ]);
  for (const workload of corpus) {
    assertEquals(
      JSON.parse(transport(workload, "json")),
      workload.records.map((record) => record.json),
    );
    assertEquals(
      transport(workload, "jsonl").trim().split("\n").map((line) =>
        JSON.parse(line)
      ),
      workload.records.map((record) => record.json),
    );
    assertEquals(transport(workload, "codec").split("\n").length, 3);
  }
  assertEquals(corpus[3].records[0].json, codecCorpus(1)[3].records[0].json);
  assertThrows(() => codecCorpus(0), Error, "positive");
  assertThrows(
    () => transport(corpus[0], "unknown"),
    Error,
    "Unknown transport",
  );
});
