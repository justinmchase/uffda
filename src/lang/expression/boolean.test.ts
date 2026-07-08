import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./boolean.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.boolean",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "BOOLEAN_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["true"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Boolean, value: true },
      }),
    });

    await t.step({
      name: "BOOLEAN_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["false"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Boolean, value: false },
      }),
    });
  },
);
