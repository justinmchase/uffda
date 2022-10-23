import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "LANG.PATTERN.OR00",
    description: "can parse a reference expression",
    pattern: () => PatternLang,
    input: "x | y",
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: "ReferencePattern",
        name: "x",
      },
      right: {
        kind: "ReferencePattern",
        name: "y",
      },
    },
  },
  {
    id: "LANG.PATTERN.OR01",
    description: "can parse a projection expression",
    pattern: () => PatternLang,
    input: "(x -> $0) | y",
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: LangPatternKind.ProjectionPattern,
        pattern: {
          kind: "ReferencePattern",
          name: "x",
        },
        expression: {
          kind: LangExpressionKind.SpecialReferenceExpression,
          name: "$0",
        },
      },
      right: {
        kind: "ReferencePattern",
        name: "y",
      },
    },
  },
  {
    id: "LANG.PATTERN.OR02",
    description: "can parse two then patterns",
    pattern: () => PatternLang,
    input: "w x | y z",
    value: {
      kind: LangPatternKind.OrPattern,
      left: {
        kind: LangPatternKind.ThenPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "w",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "x",
        },
      },
      right: {
        kind: LangPatternKind.ThenPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "z",
        },
      },
    },
  },
]);
