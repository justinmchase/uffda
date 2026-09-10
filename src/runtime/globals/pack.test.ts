import { assertEquals } from "@std/assert";
import { pack } from "./pack.ts";

Deno.test("std.pack collects variadic args into an array", () => {
  assertEquals(pack(1, "a", true), [1, "a", true]);
});
