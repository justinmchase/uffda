import { assertEquals } from "@std/assert";
import { at } from "./at.ts";

Deno.test("runtime.at indexes arrays", () => {
  assertEquals(at([1, 2, 3], 1), 2);
  assertEquals(at([1, 2, 3], 5), undefined);
});

Deno.test("runtime.at indexes strings by UTF-16 code unit", () => {
  assertEquals(at("abc", 0), "a");
  assertEquals(at("abc", 2), "c");
});
