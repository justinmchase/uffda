import { assertEquals, assertThrows } from "@std/assert";
import { sub } from "./sub.ts";

Deno.test("runtime.sub subtracts right from left", () => {
  assertEquals(sub(5, 2), 3);
  assertEquals(sub(2, 5), -3);
});

Deno.test("runtime.sub rejects non-numeric operands", () => {
  assertThrows(() => sub("5", 2));
  assertThrows(() => sub(5, "2"));
});
