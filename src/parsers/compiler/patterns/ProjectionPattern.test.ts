import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

const $0 = () => {};
tests(() => [
  {
    id: "COMPILER.PATTERN.PROJECTION00",
    pattern: () => PatternCompiler,
    input: "(a -> $0)",
    specials: { $0 },
    value: {
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Reference,
        name: "a",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: $0,
      },
    },
  },
  {
    id: "COMPILER.PATTERN.PROJECTION02",
    pattern: () => PatternCompiler,
    input: `
      (items:any ->
        (
          map
          items
          (i:any -> i + 1)
        )
      )
    `,
    value: {
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Variable,
        name: "items",
        pattern: { kind: PatternKind.Any },
      },
      expression: {
        kind: ExpressionKind.Invocation,
        expression: {
          kind: ExpressionKind.Reference,
          name: "map",
        },
        args: [
          { kind: ExpressionKind.Reference, name: "items" },
          {
            kind: ExpressionKind.Lambda,
            pattern: {
              kind: PatternKind.Variable,
              name: "i",
              pattern: { kind: PatternKind.Any },
            },
            expression: {
              kind: ExpressionKind.Add,
              left: { kind: ExpressionKind.Reference, name: "i" },
              right: { kind: ExpressionKind.Value, value: 1 },
            },
          },
        ],
      },
    },
  },
]);
