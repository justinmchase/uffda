import { assertEquals, assertThrows } from "@std/assert";
import { format, maxSatisfying, parse, parseRange } from "@std/semver";
import fixtures from "./semver-fixtures.json" with { type: "json" };

Deno.test("req:modules-runtime-006 - Rust package semver selection corpus matches TypeScript reference", () => {
  for (const fixture of fixtures) {
    if ("invalid" in fixture && fixture.invalid) {
      assertThrows(() => parseRange(fixture.range), TypeError);
      continue;
    }
    const value = maxSatisfying(
      fixture.versions.flatMap((version) => {
        try {
          return [parse(version)];
        } catch (cause) {
          if (!(cause instanceof TypeError)) throw cause;
          return [];
        }
      }),
      parseRange(fixture.range),
    );
    assertEquals(value ? format(value) : null, fixture.expected, fixture.range);
  }
});
