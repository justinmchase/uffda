import { assertEquals } from "@std/assert";
import { int } from "./int.ts";

Deno.test("std.int parses digit strings as base-10 integers", () => {
  assertEquals(int("42"), 42);
  assertEquals(int(["1", "2", "3"].join("")), 123);
});
