import { tests } from "../../test.ts";
import { TestLang } from "./Lang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests("parsers.lang.patterndeclaration", () => [
  {
    id: "PATTERNDEC00",
    description: "can parse pattern declaration",
    pattern: () => TestLang,
    input: "x = y;",
    value: [{
      kind: LangPatternKind.PatternDeclaration,
      name: "x",
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "y",
      },
    }],
  },
  {
    id: "PATTERNDEC01",
    description: "can parse multiple declarations",
    pattern: () => TestLang,
    input: "x = y; a = b;",
    value: [
      {
        kind: LangPatternKind.PatternDeclaration,
        name: "x",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
      },
      {
        kind: LangPatternKind.PatternDeclaration,
        name: "a",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "b",
        },
      },
    ],
  },
]);
