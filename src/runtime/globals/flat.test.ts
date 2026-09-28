import { assertEquals, assertStrictEquals } from "@std/assert";
import { flat } from "./flat.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

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

Deno.test("globals.flat flattens wrapped arrays and carries their elements", () => {
  const a = new Wrapped(1, rootOrigin(0));
  const b = new Wrapped(2, rootOrigin(1));
  const nested = new Wrapped(
    [a, new Wrapped([b], rootOrigin(1))],
    rootOrigin(0, 2),
  );
  const [first, second] = flat(nested);
  assertStrictEquals(first, a);
  assertStrictEquals(second, b);
});
