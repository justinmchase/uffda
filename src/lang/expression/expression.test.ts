import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./expression.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.expression",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "EXPRESSION_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["1"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Number, value: 1 },
      }),
    });
    await t.step({
      name: "EXPRESSION_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["abc"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Reference, name: "abc" },
      }),
    });

    await t.step({
      name: "EXPRESSION_EXPRESSION_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "abc", '"']),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.String, values: ["abc"] },
      }),
    });

    await t.step({
      name: "EXPRESSION_EXPRESSION_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["true"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Boolean, value: true },
      }),
    });

    await t.step({
      name: "EXPRESSION_EXPRESSION_04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["null"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Value, value: null },
      }),
    });

    await t.step({
      name: "EXPRESSION_EXPRESSION_05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["[", "1", "2", "]"]),
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
          ],
        },
      }),
    });

    await t.step({
      name: "EXPRESSION_EXPRESSION_06",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["{", "name", ":", "1", "}"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Object,
          keys: [
            {
              kind: ExpressionKind.ObjectKey,
              name: "name",
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
          ],
        },
      }),
    });

    await t.step({
      name: "EXPRESSION_EXPRESSION_07",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["[", ".", ".", ".", "xs", "]"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Array,
          expressions: [
            {
              kind: ExpressionKind.ArraySpread,
              expression: { kind: ExpressionKind.Reference, name: "xs" },
            },
          ],
        },
      }),
    });

    await t.step({
      name: "EXPRESSION_EXPRESSION_08",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable([
          "{",
          ".",
          ".",
          ".",
          "base",
          ",",
          "name",
          ":",
          "1",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Object,
          keys: [
            {
              kind: ExpressionKind.ObjectSpread,
              expression: { kind: ExpressionKind.Reference, name: "base" },
            },
            {
              kind: ExpressionKind.ObjectKey,
              name: "name",
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
          ],
        },
      }),
    });
  },
);
