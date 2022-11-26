import { tests } from "../../../test.ts";
import { BinaryOperation, ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { AddExpression } from "./AddExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.ADD00",
    module: () => AddExpression,
    // input: "a + b",
    input: [
      {
        kind: LangExpressionKind.AddExpression,
        left: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
        right: { kind: LangExpressionKind.ReferenceExpression, name: "b" }
      }
    ],
    value: {
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Add,
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
