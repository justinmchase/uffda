import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "ZERORONE00",
    pattern: () => PatternLang,
    input: "a?",
    value: {
      kind: LangPatternKind.ZeroOrOnePattern,
      pattern: {
        kind: "ReferencePattern",
        name: "a",
      },
    },
  },
]);
