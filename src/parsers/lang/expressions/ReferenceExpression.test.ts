import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "REFEXP00",
    pattern: () => ExpressionLang,
    input: "a",
    value: {
      kind: LangExpressionKind.ReferenceExpression,
      name: "a",
    },
  },
]);
