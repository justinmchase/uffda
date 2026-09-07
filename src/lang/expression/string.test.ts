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
        input: Input.Iterable(['"', "123", ".", "789", '"']),
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
        input: Input.Iterable(['"', "x", "{", "y", "}", "z", '"']),
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
        input: Input.Iterable(['"', "x", "\\", "{", "y", "}", "z", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: [
            "x{y}z",
          ],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "x", "\\", '"', "y", "\\", '"', "z", '"']),
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
      name: "STRING_EXPRESSION_03A",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", "t", "\\", "n", "\\", "r", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: ["\t\n\r"],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_03B",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "\\", "\\", '"']),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.String,
          values: ["\\"],
        },
      }),
    });

    await t.step({
      name: "STRING_EXPRESSION_04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Iterable(['"', "x", "{", '"', "y", '"', "}", "z", '"']),
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
        input: Input.Iterable([
          '"',
          "x",
          "{",
          '"',
          "{",
          "y",
          "}",
          '"',
          "}",
          "z",
          '"',
        ]), // "x{"{y}"}z"
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
