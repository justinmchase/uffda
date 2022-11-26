import { tests } from "../../../test.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { PatternKind } from "../../../runtime/patterns/pattern.kind.ts";
import { LambdaExpression } from "./LambdaExpression.ts";
import { LangExpressionKind, LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.LAMBDA00",
    module: () => LambdaExpression,
    input: [
      {
        kind: LangExpressionKind.LambdaExpression,
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "a"
        },
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a"
        }
      }
    ],
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
    module: () => LambdaExpression,
    input: [
      {
        kind: LangExpressionKind.LambdaExpression,
        pattern: {
          kind: LangPatternKind.OrPattern,
          left: {
            kind: LangPatternKind.ReferencePattern,
            name: "a"
          },
          right: {
            kind: LangPatternKind.ReferencePattern,
            name: "b"
          }
        },
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "_"
        }
      }
    ],
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
    description: "(items -> (map items (i -> i + 1)))",
    module: () => LambdaExpression,
    input: [
      {
        kind: LangExpressionKind.LambdaExpression,
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "items"
        },
        expression: {
          kind: LangExpressionKind.InvocationExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "map"
          },
          arguments: [
            {
              kind: LangExpressionKind.ReferenceExpression,
              name: "items",
            },
            {
              kind: LangExpressionKind.LambdaExpression,
              pattern: {
                kind: LangPatternKind.ReferencePattern,
                name: "i",
              },
              expression: {
                kind: LangExpressionKind.AddExpression,
                left: {
                  kind: LangExpressionKind.ReferenceExpression,
                  name: "i"
                },
                right: {
                  kind: LangExpressionKind.NumberExpression,
                  value: 1
                }
              }
            }
          ]
        }
      }
    ],
    value: {
      kind: ExpressionKind.Lambda,
      pattern: {
        kind: PatternKind.Reference,
        name: "items"
      },
      expression: {
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
                kind: ExpressionKind.Value,
                value: 1
              },
            },
          },
        ],
      }
    },
  },
]);
