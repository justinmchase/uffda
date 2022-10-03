import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "THEN01",
    description: "can parse x then y references",
    pattern: () => PatternLang,
    input: "x y",
    value: {
      kind: LangPatternKind.ThenPattern,
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
  {
    id: "THEN02",
    description: "can parse variable string",
    pattern: () => PatternLang,
    input: "x:y z",
    value: {
      kind: LangPatternKind.ThenPattern,
      left: {
        kind: LangPatternKind.VariablePattern,
        name: "x",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
      },
      right: {
        kind: LangPatternKind.ReferencePattern,
        name: "z",
      },
    },
  },
]);
