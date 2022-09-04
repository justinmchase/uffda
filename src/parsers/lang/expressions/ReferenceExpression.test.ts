import { tests } from "../../../test.ts";
import { TestLang } from "../TestLang.test.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "REFEXP00",
    pattern: () => TestLang,
    input: "A -> a",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
    },
  },
]);
