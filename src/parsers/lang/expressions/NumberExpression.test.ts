import { tests } from "../../../test.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "NUMBER00",
    pattern: () => ExpressionLang,
    input: "1",
    value: { kind: LangExpressionKind.NumberExpression, value: 1 },
  },
  {
    future: true,
    id: "NUMBER01",
    pattern: () => ExpressionLang,
    input: "A -> 1.1",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: { kind: LangExpressionKind.NumberExpression, value: 1 },
    },
  },
  {
    id: "NUMBER02",
    pattern: () => ExpressionLang,
    input: "1 + 2",
    value: {
      kind: LangExpressionKind.AddExpression,
      left: { kind: LangExpressionKind.NumberExpression, value: 1 },
      right: { kind: LangExpressionKind.NumberExpression, value: 2 },
    },
  },
  {
    id: "NUMBER03",
    pattern: () => ExpressionLang,
    input: "(1)",
    value: {
      kind: "InvocationExpression",
      expression: { kind: "NumberExpression", value: 1 },
      arguments: [],
    },
  },
]);
