import { assertEquals, assertStrictEquals } from "@std/assert";
import { id } from "./id.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("std.id returns its input unchanged", () => {
  const input = { a: 1 };
  assertEquals(id(input), input);
});

Deno.test("globals.id carries metadata", () => {
  assertEquals(
    metadataOf(id)?.parameters.map((p) => p.name),
    ["value"],
  );
});

Deno.test("req:runtime-memory-001 req:standard-library-002 - id returns the same aggregate reference", () => {
  const inputs: unknown[] = [
    [1],
    { value: 1 },
    new Map(),
    new Set(),
    new Uint8Array([1]),
    new Date(0),
    new Error("failure"),
    1n,
    Symbol.for("uffda-id-reference"),
    undefined,
    new Wrapped({ value: 1 }, rootOrigin(0)),
  ];
  for (const input of inputs) {
    assertStrictEquals(id(input), input);
  }
});
