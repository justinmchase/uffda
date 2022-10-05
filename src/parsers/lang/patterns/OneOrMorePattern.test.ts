import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "ONEORMORE00",
    pattern: () => PatternLang,
    input: "x+",
    value: {
      kind: LangPatternKind.OneOrMorePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
    },
  },
]);
