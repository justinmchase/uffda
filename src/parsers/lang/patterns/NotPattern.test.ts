import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "NOT00",
    description: "^x",
    pattern: () => PatternLang,
    input: "^x",
    value: {
      kind: LangPatternKind.NotPattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
