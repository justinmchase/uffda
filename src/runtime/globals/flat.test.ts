import { assertEquals } from "@std/assert";
import { flat } from "./flat.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("std.flat flattens one level by default", () => {
  assertEquals(flat(["a", ["b", "c"]]), ["a", "b", "c"]);
});

Deno.test("std.flat respects explicit depth", () => {
  assertEquals(flat(["a", ["b", ["c"]]], 2), ["a", "b", "c"]);
});

Deno.test("globals.flat carries metadata", () => {
  assertEquals(
    metadataOf(flat)?.parameters.map((p) => p.name),
    ["self", "depth"],
  );
});
