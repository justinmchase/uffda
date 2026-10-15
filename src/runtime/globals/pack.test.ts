import { assertEquals, assertStrictEquals } from "@std/assert";
import { pack } from "./pack.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("std.pack collects variadic args into an array", () => {
  assertEquals(pack(1, "a", true), [1, "a", true]);
});

Deno.test("req:standard-library-002 - pack preserves undefined and aggregate references", () => {
  const aggregate = { value: 42 };
  const values = pack(undefined, aggregate);
  assertEquals(values[0], undefined);
  assertStrictEquals(values[1], aggregate);
});

Deno.test("globals.pack carries metadata", () => {
  assertEquals(
    metadataOf(pack)?.parameters.map((p) => p.name),
    ["values"],
  );
});
