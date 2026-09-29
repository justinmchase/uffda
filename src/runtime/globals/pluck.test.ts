import { assertEquals, assertStrictEquals } from "@std/assert";
import { assertThrows } from "@std/assert/throws";
import { pluck } from "./pluck.ts";
import { metadataOf } from "../value_metadata.ts";
import { rootOrigin, Wrapped } from "../../wrapped.ts";

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

Deno.test("globals.pluck carries metadata", () => {
  assertEquals(
    metadataOf(pluck)?.parameters.map((p) => p.name),
    ["collection", "key"],
  );
});

Deno.test("globals.pluck carries wrapped properties", () => {
  const name = new Wrapped("a", rootOrigin(1));
  const element = new Wrapped({ name }, rootOrigin(0, 3));
  const [plucked] = pluck(new Wrapped([element], rootOrigin(0, 3)), "name");
  assertStrictEquals(plucked, name);
});
