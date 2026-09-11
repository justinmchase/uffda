import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./lambda.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.lambda",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "LAMBDA_EXPRESSION_00 single param, bare reference body",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Lambda",
        input: Input.Iterable([
          "<",
          "x",
          ":",
          "any",
          ">",
          "-",
          ">",
          "x",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Lambda,
          pattern: {
            kind: PatternKind.Variable,
            name: "x",
            pattern: { kind: PatternKind.Any },
          },
          expression: { kind: ExpressionKind.Reference, name: "x" },
        },
      }),
    });

    await t.step({
      name: "LAMBDA_EXPRESSION_01 multiple params, invocation body",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Lambda",
        input: Input.Iterable([
          "<",
          "a",
          ":",
          "any",
          "b",
          ":",
          "any",
          ">",
          "-",
          ">",
          "(",
          "add",
          "a",
          "b",
          ")",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Lambda,
          pattern: {
            kind: PatternKind.Then,
            patterns: [
              {
                kind: PatternKind.Variable,
                name: "a",
                pattern: { kind: PatternKind.Any },
              },
              {
                kind: PatternKind.Variable,
                name: "b",
                pattern: { kind: PatternKind.Any },
              },
            ],
          },
          expression: {
            kind: ExpressionKind.Invocation,
            expression: { kind: ExpressionKind.Reference, name: "add" },
            args: [
              { kind: ExpressionKind.Reference, name: "a" },
              { kind: ExpressionKind.Reference, name: "b" },
            ],
          },
        },
      }),
    });

    await t.step({
      name: "LAMBDA_EXPRESSION_02 empty params means end (no args)",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Lambda",
        input: Input.Iterable([
          "<",
          ">",
          "-",
          ">",
          "1",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Lambda,
          pattern: { kind: PatternKind.End },
          expression: { kind: ExpressionKind.Number, value: 1 },
        },
      }),
    });
  },
);
