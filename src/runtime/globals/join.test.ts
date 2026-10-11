import { assertEquals, assertThrows } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { join } from "./join.ts";
import { charOrigin, rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("req:runtime-core-012 - join explicitly formats scalar elements only", () => {
  for (const value of [{}, [], () => 1]) {
    assertThrows(() => join([value]), TypeError);
    assertThrows(() => join(new Wrapped([value], rootOrigin(0))), TypeError);
    assertThrows(() => join(["a", "b"], value), TypeError);
  }
  assertEquals(join([1, null, true], "-"), "1--true");
});

Deno.test("globals.join joins elements with a separator", () => {
  assertEquals(join(["a", "b"], "-"), "a-b");
  assertEquals(join(["a", "b"], undefined), "a,b");
});

Deno.test("globals.join carries metadata", () => {
  assertEquals(
    metadataOf(join)?.parameters.map((p) => p.name),
    ["self", "separator"],
  );
});

Deno.test("globals.join keeps each element's character provenance", () => {
  const items = new Wrapped([
    new Wrapped("a", rootOrigin(2)),
    new Wrapped("b", rootOrigin(8)),
  ], rootOrigin(0, 9));
  const joined = join(items, "-") as Wrapped<string>;
  assertEquals(joined.raw, "a-b");
  assertEquals(charOrigin(joined, 0), rootOrigin(2));
  assertEquals(charOrigin(joined, 2), rootOrigin(8));
  assertEquals((join(items) as Wrapped<string>).raw, "a,b");
});
