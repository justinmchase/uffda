import { assert, assertEquals } from "@std/assert";
import { isSuccess, type Match, valueOf } from "../../match.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";
import { expressionGrammar } from "./expression.lang.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./array.uff", import.meta.url).href;

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
        entryRuleName: "Array",
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
        entryRuleName: "Array",
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
        entryRuleName: "Array",
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

const skipped = (source: string, match: Match) =>
  collectRecoveries(match).map(({ match: { originalSpan } }) =>
    source.slice(originalSpan.start, originalSpan.end)
  );

Deno.test("lang.expression.array recovers a stray element token", async () => {
  const source = "[1 ? 2]";

  const match = await expressionGrammar(source);
  assert(isSuccess(match));
  assertEquals(valueOf(match), {
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
  });
  assertEquals(skipped(source, match), ["?"]);
});

Deno.test({
  name: "lang.expression.array comments",
  ignore: p.state !== "granted",
  fn: async (t) => {
    const comment = { kind: "comment", blocks: [] };
    await t.step({
      name: "ARRAY_COMMENT_00 - comments between elements",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Array",
        input: Input.Iterable(["[", comment, "1", comment, "2", "]"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Array,
          expressions: [
            comment,
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
            comment,
            {
              kind: ExpressionKind.ArrayElement,
              expression: { kind: ExpressionKind.Number, value: 2 },
            },
          ],
        },
      }),
    });
  },
});
