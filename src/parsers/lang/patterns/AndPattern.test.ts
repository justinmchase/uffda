import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "AND00",
    description: "x & y",
    pattern: () => PatternLang,
    input: "x & y",
    value: {
      kind: LangPatternKind.AndPattern,
      left: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
      right: {
        kind: LangPatternKind.ReferencePattern,
        name: "y",
      },
    },
  },
]);
