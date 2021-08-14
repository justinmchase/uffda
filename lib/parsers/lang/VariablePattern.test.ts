import { tests } from "../../test.ts";
import { TestLang } from "./Lang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests("parsers.lang.variablepattern", () => [
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
