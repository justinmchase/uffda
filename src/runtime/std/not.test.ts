import { assertEquals } from "@std/assert";
import { not } from "./not.ts";

Deno.test("std.not negates truthiness", () => {
  assertEquals(not(true), false);
  assertEquals(not(false), true);
  assertEquals(not(0), true);
  assertEquals(not("x"), false);
});
