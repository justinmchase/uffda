import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "LANG.EXPRESSIONS.SPREAD00",
    pattern: () => ExpressionLang,
    input: "{ ...a }",
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [
        {
          kind: LangExpressionKind.ObjectSpreadExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
        },
      ],
    },
  },
  {
    id: "LANG.EXPRESSIONS.SPREAD01",
    pattern: () => ExpressionLang,
    input: "[...[]]",
    value: {
      kind: "ArrayExpression",
      expressions: [
        {
          kind: "ArraySpreadExpression",
          expression: { kind: "ArrayExpression", expressions: [] },
        },
      ],
    },
  },
  {
    id: "LANG.EXPRESSIONS.SPREAD02",
    pattern: () => ExpressionLang,
    input: "[...a.b.c]",
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [
        {
          kind: LangExpressionKind.ArraySpreadExpression,
          expression: {
            kind: LangExpressionKind.MemberExpression,
            expression: {
              kind: LangExpressionKind.MemberExpression,
              expression: {
                kind: LangExpressionKind.ReferenceExpression,
                name: "a",
              },
              name: "b",
            },
            name: "c",
          },
        },
      ],
    },
  },
  {
    id: "LANG.EXPRESSIONS.SPREAD03",
    pattern: () => ExpressionLang,
    input: "[...(a)]",
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [
        {
          kind: LangExpressionKind.ArraySpreadExpression,
          expression: {
            kind: LangExpressionKind.InvocationExpression,
            arguments: [],
            expression: {
              kind: LangExpressionKind.ReferenceExpression,
              name: "a",
            },
          },
        },
      ],
    },
  },
]);
