import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { from_entries } from "./from_entries.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

Deno.test("std.from_entries builds an object from [key, value] pairs", () => {
  assertEquals(from_entries([["a", 1], ["b", 2]]), { a: 1, b: 2 });
});

Deno.test("std.from_entries accepts { name, pattern } OverEntry objects", () => {
  assertEquals(
    from_entries([
      { name: "name", pattern: { kind: "any" } },
      { name: "enabled", pattern: { kind: "end" } },
    ]),
    {
      name: { kind: "any" },
      enabled: { kind: "end" },
    },
  );
});

Deno.test("std.from_entries accepts { name, value } objects", () => {
  assertEquals(from_entries([{ name: "x", value: 7 }]), { x: 7 });
});

Deno.test("std.from_entries returns {} for an empty list", () => {
  assertEquals(from_entries([]), {});
});

Deno.test("std.from_entries rejects non-arrays", () => {
  assertThrows(() => from_entries({}), TypeError);
});

Deno.test("std.from_entries rejects malformed entries", () => {
  assertThrows(() => from_entries([1]), TypeError);
  assertThrows(() => from_entries([["only-key"]]), TypeError);
});

Deno.test("globals.from_entries carries metadata", () => {
  assertEquals(
    metadataOf(from_entries)?.parameters.map((p) => p.name),
    ["entries"],
  );
});

Deno.test("globals.from_entries keys by raw keys and carries values", () => {
  const value = new Wrapped(1, rootOrigin(2));
  const entry = new Wrapped(
    [new Wrapped("a", rootOrigin(0)), value],
    rootOrigin(0, 3),
  );
  const record = from_entries(new Wrapped([entry], rootOrigin(0, 3)));
  assertEquals(Object.keys(record), ["a"]);
  assertStrictEquals(record.a, value);
});
