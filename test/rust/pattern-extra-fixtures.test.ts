import { assert, assertEquals } from "@std/assert";
import fixtures from "./pattern-extra-fixtures.json" with { type: "json" };
import { InputNormalizationMode } from "../../src/input.ts";
import { MatchKind } from "../../src/match.ts";
import { match } from "../../src/runtime/match.ts";
import { isPattern } from "../../src/runtime/patterns/pattern.ts";
import { Scope } from "../../src/runtime/scope.ts";
import { unwrap } from "../../src/wrapped.ts";

Deno.test(
  "req:character-001 req:over-001 req:switch-001 - shared Rust extra pattern fixtures",
  async (t) => {
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
  },
);
