import { tests } from "../../../test.ts";
import { Lang } from "../Lang.ts";
import { LangPatternKind, LangModuleKind } from "../lang.pattern.ts";
import { PatternModule } from "../PatternModule.ts";

tests(() => [
  {
    id: "PATTERNDEC00",
    description: "can parse pattern declaration",
    pattern: () => Lang,
    input: "x = y;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "x",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "y",
          },
        }
      ]
    },
  },
  {
    id: "PATTERNDEC01",
    description: "can parse multiple declarations",
    pattern: () => Lang,
    input: "x = y; a = b;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "x",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "y",
          },
        },
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "a",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "b",
          },
        },
      ],
    },
  },
]);
