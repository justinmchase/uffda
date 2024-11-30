import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./binary.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.binary",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "BINARY_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["1"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Number, value: 1 },
      }),
    });
    await t.step({
      name: "BINARY_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["abc"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Reference, name: "abc" },
      }),
    });

    await t.step({
      name: "BINARY_EXPRESSION_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(['"', "abc", '"']),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.String, values: ["abc"] },
      }),
    });
  },
);
