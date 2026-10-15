import { assertEquals, assertThrows } from "@std/assert";
import { metadataOf } from "../value_metadata.ts";
import { json } from "./json.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("req:runtime-core-012 - json rejects callable values", () => {
  for (const value of [() => 1, [() => 1], { f: () => 1 }]) {
    assertThrows(() => json(value), TypeError, "Cannot convert a callable");
  }
});

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

Deno.test("req:standard-library-002 - json preserves native date and error behavior", () => {
  assertEquals(json(new Date(0)), '"1970-01-01T00:00:00.000Z"');
  assertEquals(json(new Error("failure")), "{}");
  assertThrows(() => json(1n), TypeError);
});
