import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "MEMBEREXP00",
    pattern: () => ExpressionLang,
    input: "a.b",
    value: {
      kind: LangExpressionKind.MemberExpression,
      name: "b",
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    },
  },
  {
    id: "MEMBEREXP01",
    pattern: () => ExpressionLang,
    input: "a.b.c",
    value: {
      kind: LangExpressionKind.MemberExpression,
      name: "c",
      expression: {
        kind: LangExpressionKind.MemberExpression,
        name: "b",
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
      },
    },
  },
]);
