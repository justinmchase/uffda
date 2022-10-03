import { tests } from "../../../test.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionLang } from "../ExpressionLang.ts";

tests(() => [
  {
    id: "INVOKE00",
    pattern: () => ExpressionLang,
    input: "(a)",
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
      expression: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
    },
  },
  {
    id: "INVOKE01",
    pattern: () => ExpressionLang,
    input: "((a))",
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
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
  {
    id: "INVOKE02",
    pattern: () => ExpressionLang,
    input: "(a b)",
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "b",
        },
      ],
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    },
  },
  {
    id: "INVOKE03",
    pattern: () => ExpressionLang,
    input: "(a b c d)",
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "b",
        },
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "c",
        },
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "d",
        },
      ],
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    },
  },
  {
    id: "INVOKE04",
    pattern: () => ExpressionLang,
    input: "((a).join)",
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
      expression: {
        kind: LangExpressionKind.MemberExpression,
        name: "join",
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
  },
]);
