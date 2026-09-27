import { assertEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { json } from "./json.ts";

Deno.test("globals.json serializes a value", () => {
  assertEquals(json({ a: [1] }), '{"a":[1]}');
});

Deno.test("globals.json carries metadata", () => {
  assertEquals(
    metadataOf(json)?.parameters.map((p) => p.name),
    ["self"],
  );
});
