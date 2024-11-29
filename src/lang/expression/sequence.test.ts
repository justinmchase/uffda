import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./sequence.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.sequence",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "SEQUENCE_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["(", "x", ")"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Invocation,
          expression: {
            kind: ExpressionKind.Reference,
            name: "x",
          },
          args: [],
        },
      }),
    });
    await t.step({
      name: "SEQUENCE_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["(", "x", "y", "z", ")"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Invocation,
          expression: {
            kind: ExpressionKind.Reference,
            name: "x",
          },
          args: [
            {
              kind: ExpressionKind.Reference,
              name: "y",
            },
            {
              kind: ExpressionKind.Reference,
              name: "z",
            },
          ],
        },
      }),
    });
    await t.step({
      name: "SEQUENCE_EXPRESSION_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["(", "(", "fn", ")", "x", "(", "y", ")", "z", ")"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Invocation,
          expression: {
            kind: ExpressionKind.Invocation,
            expression: {
              kind: ExpressionKind.Reference,
              name: "fn",
            },
            args: [],
          },
          args: [
            {
              kind: ExpressionKind.Reference,
              name: "x",
            },
            {
              kind: ExpressionKind.Invocation,
              expression: {
                kind: ExpressionKind.Reference,
                name: "y",
              },
              args: [],
            },
            {
              kind: ExpressionKind.Reference,
              name: "z",
            },
          ],
        },
      }),
    });
  },
);
