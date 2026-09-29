import { assertEquals } from "@std/assert";
import { eq } from "./eq.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

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

Deno.test("globals.eq compares raw values, not wrappers", () => {
  assertEquals(
    eq(new Wrapped(1, rootOrigin(0)), new Wrapped(1, rootOrigin(5))),
    true,
  );
  assertEquals(eq(new Wrapped(1, rootOrigin(0)), 2), false);
});
