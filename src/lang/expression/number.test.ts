import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./number.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.number",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "NUMBER_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["1"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Number, value: 1 },
      }),
    });
    await t.step({
      name: "NUMBER_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["123"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Number, value: 123 },
      }),
    });
  },
);
