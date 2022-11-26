import { tests } from "../../../test.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { SubtractExpression } from "./SubtractExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.SUBTRACT00",
    module: () => SubtractExpression,
    description: "a - b",
    input: [
      {
        kind: LangExpressionKind.SubtractExpression,
        left: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
        right: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "b",
        }
      }
    ],
    value: {
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Subtract,
      left: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      right: {
        kind: ExpressionKind.Reference,
        name: "b",
      },
    },
  },
]);
