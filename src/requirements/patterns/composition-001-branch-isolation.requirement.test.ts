import { assertEquals } from "@std/assert";
import { Input, InputNormalizationMode } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { match } from "../../runtime/match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Scope } from "../../runtime/scope.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:composition-001 - Composition isolates failing exploratory branches from sibling branches and caller-visible scope", async (t) => {
  await t.step(
    "failed exploratory consumption does not prevent a sibling branch from matching the original input",
    patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Any },
              { kind: PatternKind.Equal, value: "z" },
            ],
          },
          { kind: PatternKind.Equal, value: "a" },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
      done: true,
    }),
  );

  await t.step(
    "temporary bindings from a failed branch do not leak into the successful result scope",
    async () => {
      const scope = Scope.From("a", { kind: InputNormalizationMode.Iterable });
      const pattern: Pattern = {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Then,
            patterns: [
              {
                kind: PatternKind.Variable,
                name: "x",
                pattern: { kind: PatternKind.Any },
              },
              { kind: PatternKind.Equal, value: "z" },
            ],
          },
          {
            kind: PatternKind.Variable,
            name: "y",
            pattern: { kind: PatternKind.Any },
          },
        ],
      };

      const m = await match(pattern, scope);

      assertEquals(scope.variables.size, 0);
      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind !== MatchKind.Ok) return;
      assertEquals(m.scope.variables.has("x"), false);
      assertEquals(m.scope.variables.get("y"), "a");
    },
  );
});
