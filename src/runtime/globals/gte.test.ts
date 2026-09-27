import { assertEquals } from "@std/assert";
import { gte } from "./gte.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("runtime.gte is true when left sorts after or equal to right", () => {
  assertEquals(gte(2, 1), true);
  assertEquals(gte(2, 2), true);
  assertEquals(gte(1, 2), false);
});

Deno.test("globals.gte carries metadata", () => {
  assertEquals(
    metadataOf(gte)?.parameters.map((p) => p.name),
    ["left", "right"],
  );
});
