import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "ARRAY00",
    pattern: () => TestLang,
    input: "A -> []",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.ArrayExpression,
        expressions: [],
      },
    },
  },
  {
    id: "ARRAY01",
    pattern: () => TestLang,
    input: "A -> [a b c]",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.ArrayExpression,
        expressions: [
          {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
          {
            kind: LangExpressionKind.ReferenceExpression,
            name: "b",
          },
          {
            kind: LangExpressionKind.ReferenceExpression,
            name: "c",
          },
        ],
      },
    },
  },
  {
    id: "ARRAY02",
    pattern: () => TestLang,
    input: "A -> ([])",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.InvocationExpression,
        arguments: [],
        expression: {
          kind: LangExpressionKind.ArrayExpression,
          expressions: [],
        },
      },
    },
  },
  {
    id: "ARRAY03",
    pattern: () => TestLang,
    input: "A -> [].join",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.MemberExpression,
        name: "join",
        expression: {
          kind: LangExpressionKind.ArrayExpression,
          expressions: [],
        },
      },
    },
  },
]);
