import { assertEquals } from "@std/assert";
import { flat } from "./flat.ts";

Deno.test("std.flat flattens one level by default", () => {
  assertEquals(flat(["a", ["b", "c"]]), ["a", "b", "c"]);
});

Deno.test("std.flat respects explicit depth", () => {
  assertEquals(flat(["a", ["b", ["c"]]], 2), ["a", "b", "c"]);
});
