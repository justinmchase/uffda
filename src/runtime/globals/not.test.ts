import { assertEquals } from "@std/assert";
import { not } from "./not.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("std.not negates truthiness", () => {
  assertEquals(not(true), false);
  assertEquals(not(false), true);
  assertEquals(not(0), true);
  assertEquals(not("x"), false);
});

Deno.test("globals.not carries metadata", () => {
  assertEquals(
    metadataOf(not)?.parameters.map((p) => p.name),
    ["value"],
  );
});
