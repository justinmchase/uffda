import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "MUST00",
    description: "x!",
    pattern: () => PatternLang,
    input: "x!",
    value: {
      kind: LangPatternKind.MustPattern,
      name: "PatternExpected",
      description: "ReferencePattern is expected",
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
