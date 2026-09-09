import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./projection.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.projection",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "PROJECTION_LANG_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Projection",
        input: Input.Iterable(["any"]),
        kind: MatchKind.Ok,
        value: { kind: PatternKind.Any },
      }),
    });

    await t.step({
      name: "PROJECTION_LANG_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Projection",
        input: Input.Iterable(["any", "-", ">", "1"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Projection,
          pattern: { kind: PatternKind.Any },
          expression: { kind: ExpressionKind.Number, value: 1 },
        },
      }),
    });
  },
});
