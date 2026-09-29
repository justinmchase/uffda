import { assertEquals } from "@std/assert";
import { has } from "./has.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("std.has checks Set, array, and object membership", () => {
  assertEquals(has(new Set(["a", "b"]), "a"), true);
  assertEquals(has(new Set(["a"]), "z"), false);
  assertEquals(has(["x", "y"], "y"), true);
  assertEquals(has({ name: 1 }, "name"), true);
  assertEquals(has({ name: 1 }, "other"), false);
  assertEquals(has(null, "x"), false);
});

Deno.test("globals.has carries metadata", () => {
  assertEquals(
    metadataOf(has)?.parameters.map((p) => p.name),
    ["collection", "value"],
  );
});

Deno.test("globals.has compares raw members (SameValueZero)", () => {
  const items = new Wrapped([
    new Wrapped(1, rootOrigin(0)),
    new Wrapped(NaN, rootOrigin(1)),
  ], rootOrigin(0, 2));
  assertEquals(has(items, new Wrapped(1, rootOrigin(5))), true);
  assertEquals(has(items, NaN), true);
  assertEquals(has(items, 2), false);
});
