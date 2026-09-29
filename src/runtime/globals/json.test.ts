import { assertEquals } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { json } from "./json.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("globals.json serializes a value", () => {
  assertEquals(json({ a: [1] }), '{"a":[1]}');
});

Deno.test("globals.json carries metadata", () => {
  assertEquals(
    metadataOf(json)?.parameters.map((p) => p.name),
    ["self"],
  );
});

Deno.test("globals.json serializes the fully raw value", () => {
  assertEquals(
    json(new Wrapped([new Wrapped(1, rootOrigin(0))], rootOrigin(0))),
    "[1]",
  );
});
