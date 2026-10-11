import { assertEquals } from "@std/assert";
import fixtures from "./string-fixtures.json" with { type: "json" };
import { at } from "../../src/runtime/globals/at.ts";
import { slice } from "../../src/runtime/globals/slice.ts";

Deno.test("req:runtime-strings-001 - lossless JSON string fixtures match host UTF16 units", () => {
  for (const { source, units } of fixtures) {
    const value: string = JSON.parse(source);
    assertEquals(
      Array.from(
        { length: value.length },
        (_, index) => value.charCodeAt(index),
      ),
      units,
      source,
    );
    const restored: string = JSON.parse(JSON.stringify(value));
    assertEquals(restored, value);
  }
});

Deno.test("req:runtime-strings-002 - shared strings retain units through runtime operations and keys", () => {
  for (const { source, units } of fixtures) {
    const value: string = JSON.parse(source);
    assertEquals(value.length, units.length);
    for (let index = 0; index < units.length; index++) {
      assertEquals((at(value, index) as string).charCodeAt(0), units[index]);
      assertEquals(
        (slice(value, index, index + 1) as string).charCodeAt(0),
        units[index],
      );
    }
    assertEquals(Array.from(value).join(""), value);
    const object = { [value]: value };
    assertEquals(Object.keys(object), [value]);
    assertEquals(JSON.parse(JSON.stringify(object))[value], value);
  }
  const pair = "\ud800" + "\udc00";
  assertEquals(Array.from(pair), ["𐀀"]);
});
