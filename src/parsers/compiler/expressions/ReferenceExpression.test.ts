import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ReferenceExpression } from "./ReferenceExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.REFERENCE00",
    module: () => ReferenceExpression,
    input: [
      {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    ],
    value: {
      kind: ExpressionKind.Reference,
      name: "a",
    },
  },
]);
