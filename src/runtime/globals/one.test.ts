import { assertEquals } from "@std/assert";
import { one } from "./one.ts";

Deno.test("std.one returns the sole element unchanged", () => {
  assertEquals(
    one([{ kind: "any" }], { kind: "and", patterns: [{ kind: "any" }] }),
    { kind: "any" },
  );
});

Deno.test("std.one returns the full value when items is empty or multi", () => {
  const andFull = {
    kind: "and",
    patterns: [{ kind: "any" }, { kind: "fail" }],
  };
  assertEquals(one(andFull.patterns, andFull), andFull);
  assertEquals(one([], { kind: "and", patterns: [] }), {
    kind: "and",
    patterns: [],
  });

  const pipelineFull = {
    kind: "pipeline",
    steps: [{ kind: "any" }, { kind: "end" }],
  };
  assertEquals(one(pipelineFull.steps, pipelineFull), pipelineFull);
});
