import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { StringExpression } from "./StringExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "COMPILER.EXPRESSION.STRING00",
    module: () => StringExpression,
    // input: "'abc'",
    input: [
      { kind: LangExpressionKind.StringExpression, value: "abc" },
    ],
    value: {
      kind: ExpressionKind.Value,
      value: "abc",
    },
  },
]);
