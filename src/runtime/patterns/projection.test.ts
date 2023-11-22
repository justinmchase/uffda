import { patternTest } from "../../test.ts";
import { ExpressionKind } from "../expressions/mod.ts";
import { PatternKind } from "./pattern.kind.ts";
import { Input } from "../../input.ts";

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
      input: new Input([7]),
      value: 11,
    }),
  });

  await t.step({
    name: "PROJECTION01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ v0 }) => v0,
        },
      },
      input: new Input([7]),
      variables: new Map([ ["v0", 11] ]),
      value: 11,
    }),
  });

  const $0 = () => 11;
  await t.step({
    name: "PROJECTION02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ $0 }) => (console.log($0), $0()),
        },
      },
      input: new Input([7]),
      variables: new Map([["$0", $0]]),
      value: 11,
    }),
  });
});
