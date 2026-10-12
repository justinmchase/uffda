import { assert, assertEquals } from "@std/assert";
import fixtures from "./pattern-fixtures.json" with { type: "json" };
import { InputNormalizationMode } from "../../src/input.ts";
import { MatchKind } from "../../src/match.ts";
import { match } from "../../src/runtime/match.ts";
import { isPattern } from "../../src/runtime/patterns/pattern.ts";
import { Scope } from "../../src/runtime/scope.ts";
import { unwrap } from "../../src/wrapped.ts";

Deno.test("req:any-001 req:equal-002 req:equal-006 req:includes-001 req:between-001 req:then-001 req:or-001 req:composition-001 req:variable-001 req:lookahead-001 req:skip-002 req:into-001 req:except-001 req:type-001 req:quantifier-001 - shared Rust pattern fixtures", async (t) => {
  for (const fixture of fixtures) {
    await t.step(fixture.name, async () => {
      assert(isPattern(fixture.ast));
      const result = await match(
        fixture.ast,
        Scope.From(fixture.input, { kind: InputNormalizationMode.Iterable }),
      );
      assertEquals(result.kind, fixture.kind);
      assert(
        result.kind === MatchKind.Ok || result.kind === MatchKind.Fail,
        "fixture must not convert errors or skipped values to JSON",
      );
      assertEquals(result.scope.stream.index, fixture.end);
      if (result.kind === MatchKind.Ok) {
        assertEquals(unwrap(result.value), fixture.expected);
      }
    });
  }
});
