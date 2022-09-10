import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "INVOKE00",
    pattern: () => TestLang,
    input: "A -> (a)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.InvocationExpression,
        arguments: [],
        expression: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
      },
    },
  },
  {
    id: "INVOKE01",
    pattern: () => TestLang,
    input: "A -> ((a))",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
  {
    id: "INVOKE02",
    pattern: () => TestLang,
    input: "A -> (a b)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
  {
    id: "INVOKE03",
    pattern: () => TestLang,
    input: "A -> (a b c d)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
  {
    id: "INVOKE04",
    pattern: () => TestLang,
    input: "A -> ((a).join)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
]);
