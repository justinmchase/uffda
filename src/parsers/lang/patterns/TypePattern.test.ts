import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "TYPE00",
    pattern: () => PatternLang,
    input: "string",
    value: {
      kind: LangPatternKind.StringPattern,
    },
  },
  {
    id: "TYPE01",
    pattern: () => PatternLang,
    input: "boolean",
    value: {
      kind: LangPatternKind.BooleanPattern,
    },
  },

  {
    id: "TYPE00",
    pattern: () => PatternLang,
    input: "number",
    value: {
      kind: LangPatternKind.NumberPattern,
    },
  },
]);
