import { assertEquals } from "@std/assert";
import { gte } from "./gte.ts";

Deno.test("runtime.gte is true when left sorts after or equal to right", () => {
  assertEquals(gte(2, 1), true);
  assertEquals(gte(2, 2), true);
  assertEquals(gte(1, 2), false);
});
