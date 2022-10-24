import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "PROJECT00",
    pattern: () => PatternLang,
    input: "(x -> $0)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
      expression: {
        kind: LangExpressionKind.SpecialReferenceExpression,
        name: "$0",
      },
    },
  },
  {
    id: "PROJECT01",
    pattern: () => PatternLang,
    input: "(x:y -> $0)",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: {
        kind: LangPatternKind.VariablePattern,
        name: "x",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
      },
      expression: {
        kind: LangExpressionKind.SpecialReferenceExpression,
        name: "$0",
      },
    },
  },
]);
