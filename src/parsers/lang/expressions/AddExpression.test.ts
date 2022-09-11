import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "ADD00",
    pattern: () => TestLang,
    input: "A -> 1 + 2",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.AddExpression,
        left: { kind: LangExpressionKind.NumberExpression, value: 1 },
        right: { kind: LangExpressionKind.NumberExpression, value: 2 },
      },
    },
  },
  {
    id: "ADD01",
    pattern: () => TestLang,
    input: "A -> a + b",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.AddExpression,
        left: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
        right: { kind: LangExpressionKind.ReferenceExpression, name: "b" },
      },
    },
  },
  {
    id: "ADD02",
    pattern: () => TestLang,
    input: "A -> (a.b) + c.d",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
]);
