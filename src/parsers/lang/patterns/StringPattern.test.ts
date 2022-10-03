import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "STRINGPATTERN00",
    description: "Can parse strings",
    pattern: () => PatternLang,
    input: "'abc'",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: "abc",
    },
  },
]);
