import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "ZERORMROE00",
    description: "can parse a*",
    pattern: () => PatternLang,
    input: "a*",
    value: {
      kind: LangPatternKind.ZeroOrMorePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "a",
      },
    },
  },
]);
