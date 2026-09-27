import { assertEquals } from "@std/assert";
import { pack } from "./pack.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("std.pack collects variadic args into an array", () => {
  assertEquals(pack(1, "a", true), [1, "a", true]);
});

Deno.test("globals.pack carries metadata", () => {
  assertEquals(
    metadataOf(pack)?.parameters.map((p) => p.name),
    ["values"],
  );
});
