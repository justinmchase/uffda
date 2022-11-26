import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { NumberExpression } from "./NumberExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.NUMBER00",
    module: () => NumberExpression,
    input: [
      { kind: LangExpressionKind.NumberExpression, value: 1 }
    ],
    value: {
      kind: ExpressionKind.Value,
      value: 1,
    },
  },
]);
