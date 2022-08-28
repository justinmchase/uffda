import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(import.meta.url, () => [
  {
    id: "ZERORMROE00",
    description: "can parse a*",
    pattern: () => TestLang,
    input: "Test = a*;",
    value: [{
      kind: LangPatternKind.PatternDeclaration,
      name: "Test",
      pattern: {
        kind: LangPatternKind.ZeroOrMorePattern,
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "a",
        },
      },
    }],
  },
]);
