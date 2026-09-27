import { assertEquals } from "@std/assert";
import { eq } from "./eq.ts";
import { metadataOf } from "../value_metadata.ts";

Deno.test("std.eq uses strict equality", () => {
  assertEquals(eq(1, 1), true);
  assertEquals(eq(1, "1"), false);
  assertEquals(eq(null, undefined), false);
});

Deno.test("globals.eq carries metadata", () => {
  assertEquals(
    metadataOf(eq)?.parameters.map((p) => p.name),
    ["left", "right"],
  );
});
