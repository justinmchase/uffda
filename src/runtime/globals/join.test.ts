import { assertEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { join } from "./join.ts";

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
