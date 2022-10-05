import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "EQUAL00",
    description: "'a'",
    pattern: () => PatternLang,
    input: "'a'",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: "a",
    },
  },
  {
    id: "EQUAL01",
    description: "1",
    pattern: () => PatternLang,
    input: "1",
    value: {
      kind: LangPatternKind.EqualPattern,
      value: 1,
    },
  },
]);
