import { assertEquals } from "@std/assert";
import { PatternKind } from "./pattern.kind.ts";
import {
  type Pattern,
  type ResolveReferencePattern,
  ResolveTargetKind,
} from "./pattern.ts";
import { isPattern } from "./pattern.ts";

Deno.test("runtime.patterns supports literal reference resolve patterns", () => {
  const pattern: ResolveReferencePattern = {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Reference,
    name: "Value",
    args: [],
  };

  assertEquals(pattern.name, "Value");
  assertEquals(isPattern(pattern), true);
  assertEquals(isPattern({ kind: "unknown" }), false);
});

Deno.test("runtime.patterns accepts Over patterns with separate rest children", () => {
  const pattern: Pattern = {
    kind: PatternKind.Over,
    keys: {},
    rest: [{
      kind: "pattern",
      entry: "entry",
      key: { kind: PatternKind.Any },
      value: { kind: PatternKind.Any },
    }],
  };

  assertEquals(isPattern(pattern), true);
});
