import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "ANY00",
    description: "any",
    pattern: () => PatternLang,
    input: "any",
    value: {
      kind: LangPatternKind.AnyPattern,
    },
  },
]);
