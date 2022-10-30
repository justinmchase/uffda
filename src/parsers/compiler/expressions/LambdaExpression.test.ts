import { tests } from "../../../test.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";
import { PatternKind } from "../../../runtime/patterns/pattern.kind.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.LAMBDA00",
    pattern: () => ExpressionCompiler,
    input: "(a -> a)",
    value: {
      kind: ExpressionKind.Lambda,
      pattern: {
        kind: PatternKind.Reference,
        name: "a",
      },
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
    },
  },

  {
    id: "COMPILER.EXPRESSION.LAMBDA01",
    pattern: () => ExpressionCompiler,
    input: "(a | b -> _)",
    value: {
      kind: ExpressionKind.Lambda,
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "a",
          },
          {
            kind: PatternKind.Reference,
            name: "b",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Reference,
        name: "_",
      },
    },
  },
  {
    id: "COMPILER.EXPRESSION.LAMBDA02",
    pattern: () => ExpressionCompiler,
    input: "(map items (i -> i + i))",
    value: {
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "map",
      },
      args: [
        {
          kind: ExpressionKind.Reference,
          name: "items",
        },
        {
          kind: ExpressionKind.Lambda,
          pattern: {
            kind: PatternKind.Reference,
            name: "i",
          },
          expression: {
            kind: ExpressionKind.Binary,
            op: BinaryOperation.Add,
            left: {
              kind: ExpressionKind.Reference,
              name: "i",
            },
            right: {
              kind: ExpressionKind.Reference,
              name: "i",
            },
          },
        },
      ],
    },
  },
]);
