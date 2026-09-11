import { assertEquals } from "@std/assert";
import { gt } from "./gt.ts";

Deno.test("runtime.gt is true only when left sorts strictly after right", () => {
  assertEquals(gt(2, 1), true);
  assertEquals(gt(1, 2), false);
  assertEquals(gt(2, 2), false);
});
