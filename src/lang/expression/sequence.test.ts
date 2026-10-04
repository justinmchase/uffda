import { assert, assertEquals } from "@std/assert";
import { isSuccess, type Match, valueOf } from "../../match.ts";
import { collectRecoveries } from "../../runtime/recovery.ts";
import { expressionGrammar } from "./expression.lang.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./sequence.uff", import.meta.url).href;

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
        entryRuleName: "Sequence",
        input: Input.Iterable(["(", "x", ")"]),
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
        entryRuleName: "Sequence",
        input: Input.Iterable(["(", "x", "y", "z", ")"]),
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
        entryRuleName: "Sequence",
        input: Input.Iterable([
          "(",
          "(",
          "fn",
          ")",
          "x",
          "(",
          "y",
          ")",
          "z",
          ")",
        ]),
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

    await t.step({
      name: "SEQUENCE_EXPRESSION_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Sequence",
        input: Input.Iterable([
          "(",
          "coalesce",
          "x",
          ".",
          ".",
          ".",
          "y",
          ")",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Invocation,
          expression: {
            kind: ExpressionKind.Reference,
            name: "coalesce",
          },
          args: [
            {
              kind: ExpressionKind.Reference,
              name: "x",
            },
            {
              kind: ExpressionKind.InvocationSpread,
              expression: {
                kind: ExpressionKind.Reference,
                name: "y",
              },
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

Deno.test("lang.expression.sequence recovers a stray argument token", async () => {
  const source = "(f x ? y)";

  const match = await expressionGrammar(source);
  assert(isSuccess(match));
  assertEquals(valueOf(match), {
    kind: ExpressionKind.Invocation,
    expression: { kind: ExpressionKind.Reference, name: "f" },
    args: [
      { kind: ExpressionKind.Reference, name: "x" },
      { kind: ExpressionKind.Reference, name: "y" },
    ],
  });
  assertEquals(skipped(source, match), ["?"]);
});

Deno.test({
  name: "lang.expression.sequence comments",
  ignore: p.state !== "granted",
  fn: async (t) => {
    const comment = { kind: "comment", blocks: [] };
    await t.step({
      name: "SEQUENCE_COMMENT_00 - comments between arguments",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Sequence",
        input: Input.Iterable(["(", "f", comment, "x", comment, ")"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Invocation,
          expression: { kind: ExpressionKind.Reference, name: "f" },
          args: [
            comment,
            { kind: ExpressionKind.Reference, name: "x" },
            comment,
          ],
        },
      }),
    });
  },
});
