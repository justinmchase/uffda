import { assertEquals, assertThrows } from "@std/assert";
import { from_entries } from "./from_entries.ts";

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
