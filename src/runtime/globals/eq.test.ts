import { assertEquals } from "@std/assert";
import { eq } from "./eq.ts";

Deno.test("std.eq uses strict equality", () => {
  assertEquals(eq(1, 1), true);
  assertEquals(eq(1, "1"), false);
  assertEquals(eq(null, undefined), false);
});
