import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "SPECREFEXP00",
    description: "Can parse special reference",
    pattern: () => ExpressionLang,
    input: "$0",
    value: {
      kind: LangExpressionKind.SpecialReferenceExpression,
      name: "$0"
    }
  }
]);
