import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./string.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.string",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "STRING_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(['"', "123", ".", "789", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: ["123.789"],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(['"', "x", "$", "(", "y", ")", "z", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: [
            "x",
            {
              kind: ExpressionKind.Reference,
              name: "y",
            },
            "z",
          ],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(['"', "x", "\\", "$", "(", "y", ")", "z", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: [
            "x$(y)z",
          ],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(['"', "x", "\\", '"', "y", "\\", '"', "z", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: [
            'x"y"z',
          ],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(['"', "x", "$", "(", '"', "y", '"', ")", "z", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: [
            "x",
            { kind: ExpressionKind.String, values: ["y"] },
            "z",
          ],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From([
          '"',
          "x",
          "$",
          "(",
          '"',
          "$",
          "(",
          "y",
          ")",
          '"',
          ")",
          "z",
          '"',
        ]), // "x$("$(y)")z"
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: [
            "x",
            {
              kind: ExpressionKind.String,
              values: [
                {
                  kind: ExpressionKind.Reference,
                  name: "y",
                },
              ],
            },
            "z",
          ],
        },
      }),
    });
  },
);
