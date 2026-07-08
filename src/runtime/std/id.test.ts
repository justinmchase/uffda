import { assertEquals } from "@std/assert";
import { id } from "./id.ts";

Deno.test("std.id returns its input unchanged", () => {
  const input = { a: 1 };
  assertEquals(id(input), input);
});
