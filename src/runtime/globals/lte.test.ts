import { assertEquals } from "@std/assert";
import { lte } from "./lte.ts";

Deno.test("runtime.lte is true when left sorts before or equal to right", () => {
  assertEquals(lte(1, 2), true);
  assertEquals(lte(2, 2), true);
  assertEquals(lte(2, 1), false);
});
