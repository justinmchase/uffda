import { assertEquals } from "@std/assert";
import { when } from "./when.ts";

Deno.test("std.when selects then or else by truthiness", () => {
  assertEquals(when(true, "a", "b"), "a");
  assertEquals(when(false, "a", "b"), "b");
  assertEquals(when(0, "a", "b"), "b");
  assertEquals(when("x", 1, 2), 1);
});
