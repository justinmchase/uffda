import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "OBJECT00",
    pattern: () => TestLang,
    input: "A -> {}",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.ObjectExpression,
        keys: []
      },
    },
  },
  {
    id: "OBJECT01",
    pattern: () => TestLang,
    input: "A -> { a = 1 }",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
  {
    id: "OBJECT02",
    pattern: () => TestLang,
    input: "A -> { a = 1, b = 2 }",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
  {
    id: "OBJECT03",
    pattern: () => TestLang,
    input: "A -> { a = 1, b = 2, }",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
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
  },
]);
