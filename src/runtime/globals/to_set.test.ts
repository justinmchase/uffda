import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { to_set } from "./to_set.ts";

Deno.test("std.to_set builds a Set from an array", () => {
  const values = to_set(["a", "b", "a"]);
  assertEquals(values instanceof Set, true);
  assertEquals(values.has("a"), true);
  assertEquals(values.has("b"), true);
  assertEquals(values.size, 2);
});

Deno.test("std.to_set copies object values, Map values, and Sets", () => {
  assertEquals([...to_set({ x: "a", y: "b" })].sort(), ["a", "b"]);
  assertEquals(
    [...to_set(new Map([["k", "a"], ["m", "b"]]))].sort(),
    ["a", "b"],
  );
  assertEquals([...to_set(new Set(["a", "a", "b"]))].sort(), ["a", "b"]);
});

Deno.test("std.to_set rejects non-collections", () => {
  assertThrows(() => to_set("a"), TypeError);
});
