import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "SPREAD00",
    pattern: () => TestLang,
    input: "A -> [...a]",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: "ArrayExpression",
        expressions: [
          {
            kind: "SpreadExpression",
            expression: { kind: "ReferenceExpression", name: "a" },
          },
        ],
      },
    },
  },
  {
    id: "SPREAD01",
    pattern: () => TestLang,
    input: "A -> [...[]]",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: "ArrayExpression",
        expressions: [
          {
            kind: "SpreadExpression",
            expression: { kind: "ArrayExpression", expressions: [] },
          },
        ],
      },
    },
  },
  {
    id: "SPREAD02",
    pattern: () => TestLang,
    input: "A -> ...a.b.c",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
  {
    id: "SPREAD03",
    pattern: () => TestLang,
    input: "A -> ...(a)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
]);
