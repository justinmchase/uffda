import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "OBJECT00",
    pattern: () => ExpressionLang,
    input: "{}",
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: []
    },
  },
  {
    id: "OBJECT01",
    pattern: () => ExpressionLang,
    input: "{ a = 1 }",
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "a",
          expression: { kind: LangExpressionKind.NumberExpression, value: 1 }
        }
      ]
    },
  },
  {
    id: "OBJECT02",
    pattern: () => ExpressionLang,
    input: "{ a = 1, b = 2 }",
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "a",
          expression: { kind: LangExpressionKind.NumberExpression, value: 1 }
        },
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "b",
          expression: { kind: LangExpressionKind.NumberExpression, value: 2 }
        }
      ]
    },
  },
  {
    id: "OBJECT03",
    pattern: () => ExpressionLang,
    input: "{ a = 1, b = 2, }",
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "a",
          expression: { kind: LangExpressionKind.NumberExpression, value: 1 }
        },
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "b",
          expression: { kind: LangExpressionKind.NumberExpression, value: 2 }
        }
      ]
    },
  },
]);
