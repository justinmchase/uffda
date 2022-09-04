import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "MEMBEREXP00",
    pattern: () => TestLang,
    input: "A -> a.b",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.MemberExpression,
        name: "b",
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
      },
    },
  },
  {
    id: "MEMBEREXP01",
    pattern: () => TestLang,
    input: "A -> a.b.c",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.MemberExpression,
        name: "c",
        expression: {
          kind: LangExpressionKind.MemberExpression,
          name: "b",
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
        },
      },
    },
  },
]);
