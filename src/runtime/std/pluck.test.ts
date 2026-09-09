import { assertEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { pluck } from "./pluck.ts";

Deno.test("std.pluck maps a property off each array element", () => {
  assertEquals(pluck([{ name: "A" }, { name: "B" }], "name"), ["A", "B"]);
  assertEquals(pluck([{ names: ["x"] }], "names"), [["x"]]);
});

Deno.test("std.pluck maps a property off each object value", () => {
  assertEquals(
    pluck({ first: { name: "A" }, second: { name: "B" } }, "name"),
    ["A", "B"],
  );
});

Deno.test("std.pluck maps a property off each Map value", () => {
  assertEquals(
    pluck(
      new Map([
        ["a", { name: "A" }],
        ["b", { name: "B" }],
      ]),
      "name",
    ),
    ["A", "B"],
  );
});

Deno.test("std.pluck maps a property off each Set value", () => {
  assertEquals(
    pluck(new Set([{ name: "A" }, { name: "B" }]), "name"),
    ["A", "B"],
  );
});

Deno.test("std.pluck rejects non-collections", () => {
  assertThrows(() => pluck("name", "length"), TypeError);
  assertThrows(() => pluck(null, "name"), TypeError);
});
