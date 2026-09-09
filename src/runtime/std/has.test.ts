import { assertEquals } from "@std/assert";
import { has } from "./has.ts";

Deno.test("std.has checks Set, array, and object membership", () => {
  assertEquals(has(new Set(["a", "b"]), "a"), true);
  assertEquals(has(new Set(["a"]), "z"), false);
  assertEquals(has(["x", "y"], "y"), true);
  assertEquals(has({ name: 1 }, "name"), true);
  assertEquals(has({ name: 1 }, "other"), false);
  assertEquals(has(null, "x"), false);
});
