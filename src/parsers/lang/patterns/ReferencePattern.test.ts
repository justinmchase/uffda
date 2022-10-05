import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "REF00",
    description: "Can parse reference",
    pattern: () => PatternLang,
    input: "a",
    value: {
      kind: LangPatternKind.ReferencePattern,
      name: "a",
    },
  },
]);
