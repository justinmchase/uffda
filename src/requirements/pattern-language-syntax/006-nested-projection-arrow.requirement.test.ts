import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name:
      "req:pattern-language-syntax-006 - Nested projection arrow projects Projection AST",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step(
      "any -> 1 projects a projection node",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("any -> 1"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Projection,
          pattern: { kind: PatternKind.Any },
          expression: { kind: ExpressionKind.Number, value: 1 },
        },
      }),
    );

    await t.step(
      "sequence binds tighter than projection",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("any fail -> 1"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Projection,
          pattern: {
            kind: PatternKind.Then,
            patterns: [
              { kind: PatternKind.Any },
              { kind: PatternKind.Fail },
            ],
          },
          expression: { kind: ExpressionKind.Number, value: 1 },
        },
      }),
    );

    await t.step(
      "projection binds tighter than or",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("any -> 1 | fail"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Projection,
              pattern: { kind: PatternKind.Any },
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    );

    await t.step(
      "grouped projection under or is accepted",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("(any -> 1) | fail"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Projection,
              pattern: { kind: PatternKind.Any },
              expression: { kind: ExpressionKind.Number, value: 1 },
            },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    );
  },
);
