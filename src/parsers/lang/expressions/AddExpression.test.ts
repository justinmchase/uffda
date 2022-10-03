import { tests } from "../../../test.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionLang } from "../ExpressionLang.ts";

tests(() => [
  {
    id: "ADD00",
    pattern: () => ExpressionLang,
    input: "1 + 2",
    value: {
      kind: LangExpressionKind.AddExpression,
      left: { kind: LangExpressionKind.NumberExpression, value: 1 },
      right: { kind: LangExpressionKind.NumberExpression, value: 2 },
    },
  },
  {
    id: "ADD01",
    pattern: () => ExpressionLang,
    input: "a + b",
    value: {
      kind: LangExpressionKind.AddExpression,
      left: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
      right: { kind: LangExpressionKind.ReferenceExpression, name: "b" },
    },
  },
  {
    id: "ADD02",
    pattern: () => ExpressionLang,
    input: "(a.b) + c.d",
    value: {
      kind: LangExpressionKind.AddExpression,
      left: {
        kind: LangExpressionKind.InvocationExpression,
        arguments: [],
        expression: {
          kind: LangExpressionKind.MemberExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
          name: "b",
        },
      },
      right: {
        kind: LangExpressionKind.MemberExpression,
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "c",
        },
        name: "d",
      },
    },
  },
]);
