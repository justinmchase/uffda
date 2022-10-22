import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "ARRAY00",
    pattern: () => ExpressionLang,
    input: "[]",
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [],
    },
  },
  {
    id: "ARRAY01",
    pattern: () => ExpressionLang,
    input: "[a b c]",
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
        },
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "b",
          },
        },
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "c",
          },
        },
      ],
    },
  },
  {
    id: "ARRAY02",
    pattern: () => ExpressionLang,
    input: "([])",
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
      expression: {
        kind: LangExpressionKind.ArrayExpression,
        expressions: [],
      },
    },
  },
  {
    id: "ARRAY03",
    pattern: () => ExpressionLang,
    input: "[].join",
    value: {
      kind: LangExpressionKind.MemberExpression,
      name: "join",
      expression: {
        kind: LangExpressionKind.ArrayExpression,
        expressions: [],
      },
    },
  },
]);
