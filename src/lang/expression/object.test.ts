import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./object.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.object",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "OBJECT_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(["{", "}"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Object,
          keys: [],
        },
      }),
    });

    await t.step({
      name: "OBJECT_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable([
          "{",
          "name",
          ":",
          "1",
          ",",
          "active",
          ":",
          "true",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Object,
          keys: [
            {
              kind: ExpressionKind.ObjectKey,
              name: "name",
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
            {
              kind: ExpressionKind.ObjectKey,
              name: "active",
              expression: { kind: ExpressionKind.Boolean, value: true },
            },
          ],
        },
      }),
    });

    await t.step({
      name: "OBJECT_EXPRESSION_02",
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
