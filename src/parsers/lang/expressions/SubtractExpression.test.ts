import { tests } from "../../../test.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionLang } from "../ExpressionLang.ts";

tests(() => [
  {
    id: "LANG.EXPRESSION.SUBTRACT00",
    pattern: () => ExpressionLang,
    input: "11 - 7",
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: { kind: LangExpressionKind.NumberExpression, value: 11 },
      right: { kind: LangExpressionKind.NumberExpression, value: 7 },
    },
  },
  {
    id: "LANG.EXPRESSION.SUBTRACT01",
    pattern: () => ExpressionLang,
    input: "11 + 7 - 13 + 3",
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: {
        kind: LangExpressionKind.AddExpression,
        left: { kind: LangExpressionKind.NumberExpression, value: 11 },
        right: { kind: LangExpressionKind.NumberExpression, value: 7 },
      },
      right: {
        kind: LangExpressionKind.AddExpression,
        left: { kind: LangExpressionKind.NumberExpression, value: 13 },
        right: { kind: LangExpressionKind.NumberExpression, value: 3 },
      },
    },
  },
  {
    id: "LANG.EXPRESSION.SUBTRACT02",
    pattern: () => ExpressionLang,
    //     ((11 - 7) - 13) - 3
    input: "11 - 7 - 13 - 3",
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: {
        kind: LangExpressionKind.SubtractExpression,
        left: {
          kind: LangExpressionKind.SubtractExpression,
          left: { kind: LangExpressionKind.NumberExpression, value: 11 },
          right: { kind: LangExpressionKind.NumberExpression, value: 7 },
        },
        right: { kind: LangExpressionKind.NumberExpression, value: 13 },
      },
      right: { kind: LangExpressionKind.NumberExpression, value: 3 },
    },
  },
  {
    id: "LANG.EXPRESSION.SUBTRACT03",
    pattern: () => ExpressionLang,
    //     ((11 - 7) - 13) - 3
    input: "11 - 7 + 13 - 3",
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: {
        kind: LangExpressionKind.SubtractExpression,
        left: {
          kind: LangExpressionKind.NumberExpression,
          value: 11,
        },
        right: {
          kind: LangExpressionKind.AddExpression,
          left: { kind: LangExpressionKind.NumberExpression, value: 7 },
          right: { kind: LangExpressionKind.NumberExpression, value: 13 },
        },
      },
      right: { kind: LangExpressionKind.NumberExpression, value: 3 },
    },
  },
]);
