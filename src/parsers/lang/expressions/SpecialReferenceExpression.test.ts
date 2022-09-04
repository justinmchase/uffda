import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "SPECREFEXP00",
    description: "Can parse special reference",
    pattern: () => TestLang,
    input: "A -> $0",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: {
        kind: LangExpressionKind.SpecialReferenceExpression,
        name: "$0",
      },
    },
  },
]);
