import { assertEquals } from "@std/assert";
import { PatternKind } from "./pattern.kind.ts";
import { type ResolveReferencePattern, ResolveTargetKind } from "./pattern.ts";

Deno.test("runtime.patterns supports literal reference resolve patterns", () => {
  const pattern: ResolveReferencePattern = {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Reference,
    name: "Value",
    args: [],
  };

  assertEquals(pattern.name, "Value");
});
