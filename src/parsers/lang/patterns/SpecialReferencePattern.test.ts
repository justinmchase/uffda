import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "SPECREF00",
    description: "Can parse special reference",
    pattern: () => PatternLang,
    input: "$0",
    value: {
      kind: LangPatternKind.SpecialReferencePattern,
      name: "$0",
    },
  },
]);
