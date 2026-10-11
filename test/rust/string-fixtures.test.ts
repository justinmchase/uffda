import { assertEquals } from "@std/assert";
import fixtures from "./string-fixtures.json" with { type: "json" };

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
