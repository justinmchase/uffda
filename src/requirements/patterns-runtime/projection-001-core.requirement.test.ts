import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { patternTest } from "../../test.ts";

Deno.test("req:projection-001 - Projection succeeds with the expression result and preserves non-Ok child outcomes", async (t) => {
  await t.step(
    "projection succeeds with expression result",
    patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: { kind: PatternKind.Any },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ x }: { x: number }) => x * 2,
        },
      },
      input: Input.Iterable([7]),
      kind: MatchKind.Ok,
      value: 14,
    }),
  );

  await t.step(
    "projection fails without evaluating expression when child fails",
    patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Equal, value: "x" },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => {
            throw new Error("should not run");
          },
        },
      },
      input: Input.Iterable(["y"]),
      kind: MatchKind.Fail,
      done: false,
    }),
  );

  await t.step(
    "projection reports expression exception when expression throws",
    patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => {
            throw new Error("projected boom");
          },
        },
      },
      input: Input.Iterable([1]),
      kind: MatchKind.Error,
      code: MatchErrorCode.ExpressionException,
      message: "expression exception: projected boom",
      start: Path.From(0),
      end: Path.From(0),
    }),
  );

  await t.step(
    "or arm with projection can produce a different shape than the unprojected arm",
    patternTest({
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Projection,
            pattern: { kind: PatternKind.Equal, value: "a" },
            expression: {
              kind: ExpressionKind.Native,
              fn: () => ({ kind: "a" }),
            },
          },
          { kind: PatternKind.Equal, value: "b" },
        ],
      },
      input: Input.Iterable(["b"]),
      kind: MatchKind.Ok,
      value: "b",
    }),
  );
});
