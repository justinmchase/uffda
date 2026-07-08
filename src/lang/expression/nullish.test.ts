import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./nullish.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.nullish",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "NULLISH_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["null"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Value, value: null },
      }),
    });

    await t.step({
      name: "NULLISH_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["undefined"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Value, value: undefined },
      }),
    });
  },
);
