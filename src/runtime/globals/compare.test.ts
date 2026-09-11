import { assertEquals, assertThrows } from "@std/assert";
import { compare } from "./compare.ts";

Deno.test("runtime.compare orders numbers", () => {
  assertEquals(compare(1, 2), -1);
  assertEquals(compare(2, 1), 1);
  assertEquals(compare(2, 2), 0);
});

Deno.test("runtime.compare orders strings", () => {
  assertEquals(compare("a", "b"), -1);
  assertEquals(compare("b", "a"), 1);
  assertEquals(compare("a", "a"), 0);
});

Deno.test("runtime.compare rejects non-comparable or mixed-type values", () => {
  assertThrows(() => compare(1, "1"), TypeError);
  assertThrows(() => compare(null, 1), TypeError);
  assertThrows(() => compare({}, {}), TypeError);
});
