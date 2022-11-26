import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { InvocationExpression } from "./InvocationExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.INVOCATION00",
    module: () => InvocationExpression,
    description: "(a)",
    input: [
      {
        kind: LangExpressionKind.InvocationExpression,
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a"
        },
        arguments: []
      }
    ],
    value: {
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      args: [],
    },
  },
  {
    id: "COMPILER.EXPRESSION.INVOCATION01",
    module: () => InvocationExpression,
    description: "(a b c)",
    input: [
      {
        kind: LangExpressionKind.InvocationExpression,
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a"
        },
        arguments: [
          {
            kind: LangExpressionKind.ReferenceExpression,
            name: "b"
          },
          {
            kind: LangExpressionKind.ReferenceExpression,
            name: "c"
          }
        ]
      }
    ],
    value: {
      kind: ExpressionKind.Invocation,
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      args: [
        {
          kind: ExpressionKind.Reference,
          name: "b",
        },
        {
          kind: ExpressionKind.Reference,
          name: "c",
        },
      ],
    },
  },
]);
