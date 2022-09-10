import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "NUMBER00",
    pattern: () => TestLang,
    input: "A -> 1",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: { kind: LangExpressionKind.NumberExpression, value: 1 },
    },
  },
  {
    future: true,
    id: "NUMBER01",
    pattern: () => TestLang,
    input: "A -> 1.1",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: { kind: LangExpressionKind.NumberExpression, value: 1 },
    },
  },

  {
    id: "NUMBER02",
    future: true,
    pattern: () => TestLang,
    input: "A -> 1 + 1",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: { kind: LangExpressionKind.NumberExpression, value: 1 },
    },
  },
  {
    id: "NUMBER03",
    pattern: () => TestLang,
    input: "A -> (1)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: "InvocationExpression",
        arguments: [],
        expression: { kind: "NumberExpression", value: 1 },
      },
    },
  },
]);
