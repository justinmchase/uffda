import { patternTest } from "../../test.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";
import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Path } from "../../path.ts";

Deno.test("runtime.patterns.projection", async (t) => {
  await t.step({
    name: "PROJECTION00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => 11,
        },
      },
      input: Input.Iterable([7]),
      value: 11,
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PROJECTION01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: { kind: PatternKind.Any },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ x }: { x: number }) => x + 11,
        },
      },
      input: Input.Iterable([7]),
      value: 18,
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "PROJECTION02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Equal, value: "nope" },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => 11,
        },
      },
      input: Input.Iterable(["yes"]),
      kind: MatchKind.Fail,
    }),
  });

  await t.step({
    name: "PROJECTION03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => {
            throw new Error("boom");
          },
        },
      },
      input: Input.Iterable([7]),
      kind: MatchKind.Error,
      code: MatchErrorCode.ExpressionException,
      message: "expression exception: boom",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
});
