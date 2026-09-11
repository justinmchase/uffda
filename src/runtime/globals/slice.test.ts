import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { slice } from "./slice.ts";

Deno.test("globals.slice slices a string", () => {
  assertEquals(slice("hello world", 0, 5), "hello");
  assertEquals(slice("hello world", 6), "world");
  assertEquals(slice("hello world", -5), "world");
});

Deno.test("globals.slice slices an array", () => {
  assertEquals(slice([1, 2, 3, 4], 1, 3), [2, 3]);
  assertEquals(slice([1, 2, 3, 4], -2), [3, 4]);
});

Deno.test("globals.slice rejects unsupported values", () => {
  assertThrows(() => slice(42 as unknown as string, 0, 1), TypeError);
  assertThrows(() => slice(null as unknown as string, 0, 1), TypeError);
});
