import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "NUMBER00",
    description: "1",
    pattern: () => PatternLang,
    input: "1",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: 1,
    },
  },
]);
