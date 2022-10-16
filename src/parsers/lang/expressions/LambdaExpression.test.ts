import { tests } from "../../../test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { ExpressionLang } from "../ExpressionLang.ts";

tests(() => [
  {
    id: "LAMBDA00",
    pattern: () => ExpressionLang,
    input: "a -> a",
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "a" },
      expression: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
    },
  },
  {
    id: "LAMBDA01",
    pattern: () => ExpressionLang,
    input: "a -> a + 1",
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "a" },
      expression: {
        kind: LangExpressionKind.AddExpression,
        left: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
        right: {
          kind: LangExpressionKind.NumberExpression,
          value: 1,
        },
      },
    },
  },
  {
    id: "LAMBDA01",
    pattern: () => ExpressionLang,
    input: "a -> b -> a + b",
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "a" },
      expression: {
        kind: LangExpressionKind.LambdaExpression,
        pattern: { kind: LangPatternKind.ReferencePattern, name: "b" },
        expression: {
          kind: LangExpressionKind.AddExpression,
          left: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
          right: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "b",
          },
        },
      },
    },
  },
]);
