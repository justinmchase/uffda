import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { length } from "./length.ts";

Deno.test("globals.length returns the length of a string", () => {
  assertEquals(length("abc"), 3);
  assertEquals(length(""), 0);
});

Deno.test("globals.length returns the length of an array", () => {
  assertEquals(length([1, 2, 3]), 3);
  assertEquals(length([]), 0);
});

Deno.test("globals.length returns the size of a Set", () => {
  assertEquals(length(new Set([1, 2, 3])), 3);
});

Deno.test("globals.length returns the size of a Map", () => {
  assertEquals(length(new Map([["a", 1], ["b", 2]])), 2);
});

Deno.test("globals.length throws for unsupported values", () => {
  assertThrows(() => length(42), TypeError);
  assertThrows(() => length(null), TypeError);
  assertThrows(() => length({}), TypeError);
});
