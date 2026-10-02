import { assert, assertEquals } from "@std/assert";
import { isSuccess, type Match, valueOf } from "../../match.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";
import { expressionGrammar } from "./expression.lang.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./object.uff", import.meta.url).href;

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
        entryRuleName: "Object",
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
        entryRuleName: "Object",
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
        entryRuleName: "Object",
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
    await t.step({
      name: "OBJECT_EXPRESSION_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Object",
        input: Input.Iterable([
          "{",
          "[",
          "key",
          "]",
          ":",
          "1",
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Object,
          keys: [
            {
              kind: ExpressionKind.ObjectComputedKey,
              keyExpression: { kind: ExpressionKind.Reference, name: "key" },
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

Deno.test("lang.expression.object recovers a broken entry", async () => {
  const source = "{ a: 1, b: ?, c: 2 }";

  const match = await expressionGrammar(source);
  assert(isSuccess(match));
  assertEquals(valueOf(match), {
    kind: ExpressionKind.Object,
    keys: [
      {
        kind: ExpressionKind.ObjectKey,
        name: "a",
        expression: { kind: ExpressionKind.Number, value: 1 },
      },
      {
        kind: ExpressionKind.ObjectKey,
        name: "c",
        expression: { kind: ExpressionKind.Number, value: 2 },
      },
    ],
  });
  assertEquals(skipped(source, match), ["b: ?"]);

  const first = await expressionGrammar("{ ?, c: 2 }");
  assertEquals(skipped("{ ?, c: 2 }", first), ["?"]);
});

Deno.test({
  name: "lang.expression.object comments",
  ignore: p.state !== "granted",
  fn: async (t) => {
    const comment = { kind: "comment", blocks: [] };
    await t.step({
      name: "OBJECT_COMMENT_00 - comments before and after entries",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Object",
        input: Input.Iterable([
          "{",
          comment,
          "a",
          ":",
          "1",
          ",",
          comment,
          "b",
          ":",
          "2",
          comment,
          "}",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Object,
          keys: [
            comment,
            {
              kind: ExpressionKind.ObjectKey,
              name: "a",
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
            comment,
            {
              kind: ExpressionKind.ObjectKey,
              name: "b",
              expression: { kind: ExpressionKind.Number, value: 2 },
            },
            comment,
          ],
        },
      }),
    });
  },
});
