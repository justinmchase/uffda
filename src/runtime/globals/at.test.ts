import { assertEquals, assertThrows } from "@std/assert";
import { at } from "./at.ts";

Deno.test("runtime.at indexes arrays", () => {
  assertEquals(at([1, 2, 3], 1), 2);
  assertEquals(at([1, 2, 3], 5), undefined);
});

Deno.test("runtime.at indexes strings by UTF-16 code unit", () => {
  assertEquals(at("abc", 0), "a");
  assertEquals(at("abc", 2), "c");
});

Deno.test("runtime.at indexes Sets by insertion order", () => {
  const set = new Set(["a", "b", "c"]);
  assertEquals(at(set, 0), "a");
  assertEquals(at(set, 2), "c");
  assertEquals(at(set, 5), undefined);
});

Deno.test("runtime.at indexes Maps as [key, value] entries by insertion order", () => {
  const map = new Map([["a", 1], ["b", 2]]);
  assertEquals(at(map, 0), ["a", 1]);
  assertEquals(at(map, 1), ["b", 2]);
  assertEquals(at(map, 5), undefined);
});

Deno.test("runtime.at rejects unsupported types", () => {
  assertThrows(() => at({}, 0), TypeError);
});
