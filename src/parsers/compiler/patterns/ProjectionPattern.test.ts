import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangExpressionKind, LangPatternKind } from "../../lang/lang.pattern.ts";
import { ProjectionPattern } from "./ProjectionPattern.ts";

const $0 = () => {};
tests(() => [
  {
    id: "COMPILER.PATTERN.PROJECTION00",
    module: () => ProjectionPattern,
    desciption: "(a -> $0)",
    input: [
      {
        kind: LangPatternKind.ProjectionPattern,
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "a"
        },
        expression: {
          kind: LangExpressionKind.SpecialReferenceExpression,
          name: "$0"
        }
      }
    ],
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
    module: () => ProjectionPattern,
    description: `
      (items ->
        (
          map
          items
          (i -> i + 1)
        )
      )
    `,
    input: [
      {
        kind: LangPatternKind.ProjectionPattern,
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
                name: "i"
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
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Reference,
        name: "items",
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
              kind: PatternKind.Reference,
              name: "i",
            },
            expression: {
              kind: ExpressionKind.Binary,
              op: BinaryOperation.Add,
              left: { kind: ExpressionKind.Reference, name: "i" },
              right: { kind: ExpressionKind.Value, value: 1 },
            },
          },
        ],
      },
    },
  },
]);
