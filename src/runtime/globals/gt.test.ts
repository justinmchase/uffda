import { assertEquals } from "@std/assert";
import { gt } from "./gt.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("runtime.gt is true only when left sorts strictly after right", () => {
  assertEquals(gt(2, 1), true);
  assertEquals(gt(1, 2), false);
  assertEquals(gt(2, 2), false);
});

Deno.test("globals.gt carries metadata", () => {
  assertEquals(
    metadataOf(gt)?.parameters.map((p) => p.name),
    ["left", "right"],
  );
});
