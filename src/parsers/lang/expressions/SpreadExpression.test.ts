import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "SPREAD00",
    pattern: () => ExpressionLang,
    input: "...a",
    value: {
      kind: "SpreadExpression",
      expression: { kind: "ReferenceExpression", name: "a" },
    },
  },
  {
    id: "SPREAD01",
    pattern: () => ExpressionLang,
    input: "[...[]]",
    value: {
      kind: "ArrayExpression",
      expressions: [
        {
          kind: "SpreadExpression",
          expression: { kind: "ArrayExpression", expressions: [] },
        },
      ],
    },
  },
  {
    id: "SPREAD02",
    pattern: () => ExpressionLang,
    input: "...a.b.c",
    value: {
      kind: LangExpressionKind.SpreadExpression,
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
  },
  {
    id: "SPREAD03",
    pattern: () => ExpressionLang,
    input: "...(a)",
    value: {
      kind: LangExpressionKind.SpreadExpression,
      expression: {
        kind: LangExpressionKind.InvocationExpression,
        arguments: [],
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
      },
    },
  },
]);
