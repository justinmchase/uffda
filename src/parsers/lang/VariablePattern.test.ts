import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(import.meta.url, () => [
  {
    id: "VARIABLEPATTERN00",
    description: "can parse a reference as a variable",
    pattern: () => TestLang,
    input: "Test = x:y;",
    value: [{
      kind: LangPatternKind.PatternDeclaration,
      name: "Test",
      pattern: {
        kind: LangPatternKind.VariablePattern,
        name: "x",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
      },
    }],
  },
]);
