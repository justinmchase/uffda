import { tests } from "../../test.ts";
import { TestLang } from "./Lang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests("parsers.lang.zerooronepattern", () => [
  {
    id: "ZERORONE00",
    description: "can parse a?",
    pattern: () => TestLang,
    input: "Test = a?;",
    value: [{
      kind: LangPatternKind.PatternDeclaration,
      name: "Test",
      pattern: {
        kind: LangPatternKind.ZeroOrOnePattern,
        pattern: {
          kind: "ReferencePattern",
          name: "a",
        },
      },
    }],
  },
]);
