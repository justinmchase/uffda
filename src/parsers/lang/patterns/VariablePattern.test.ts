import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "VARIABLEPATTERN00",
    description: "can parse a reference as a variable",
    pattern: () => PatternLang,
    input: "x:y",
    value: {
      kind: LangPatternKind.VariablePattern,
      name: "x",
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "y",
      },
    },
  },
]);
