import { assertEquals } from "@std/assert";
import { last } from "./last.ts";

Deno.test("globals.last returns the final array element", () => {
  assertEquals(last(["a", "b", "c"], null), "c");
});

Deno.test("globals.last returns the fallback for an empty array", () => {
  assertEquals(last([], "fallback"), "fallback");
});

Deno.test("globals.last works over strings as array-likes", () => {
  assertEquals(last("ab", null), "b");
  assertEquals(last("", "fallback"), "fallback");
});
