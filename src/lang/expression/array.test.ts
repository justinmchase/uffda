import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./array.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.array",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "ARRAY_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["[", "]"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Array,
          expressions: [],
        },
      }),
    });

    await t.step({
      name: "ARRAY_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["[", "1", "2", "3", "]"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Array,
          expressions: [
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Number, value: 2 },
            },
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Number, value: 3 },
            },
          ],
        },
      }),
    });

    await t.step({
      name: "ARRAY_EXPRESSION_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["[", ".", ".", ".", "xs", "1", "]"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Array,
          expressions: [
            {
              kind: ExpressionKind.ArraySpread,
              expression: { kind: ExpressionKind.Reference, name: "xs" },
            },
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
          ],
        },
      }),
    });
  },
);
