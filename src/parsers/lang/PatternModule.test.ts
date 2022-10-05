import { tests } from "../../test.ts";
import { Lang } from "./Lang.ts";
import { LangModuleKind, LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "MOD00",
    pattern: () => Lang,
    input: "A = B;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "A",
          pattern: { kind: LangPatternKind.ReferencePattern, name: "B" },
        },
      ],
    },
  },
  {
    id: "MOD01",
    pattern: () => Lang,
    input: "import './b.uff' (B); A = B;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [
        {
          kind: LangModuleKind.ImportDeclaration,
          names: ["B"],
          modulePath: "./b.uff",
        },
      ],
      patterns: [
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "A",
          pattern: { kind: LangPatternKind.ReferencePattern, name: "B" },
        },
      ],
    },
  },
  {
    id: "MOD02",
    pattern: () => Lang,
    input: "import './b.uff' (A B);",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [
        {
          kind: LangModuleKind.ImportDeclaration,
          names: ["A", "B"],
          modulePath: "./b.uff",
        },
      ],
      patterns: [],
    },
  },
  {
    id: "MOD03",
    pattern: () => Lang,
    input: `import './b.uff' (
      A
      B
    );`,
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [
        {
          kind: LangModuleKind.ImportDeclaration,
          names: ["A", "B"],
          modulePath: "./b.uff",
        },
      ],
      patterns: [],
    },
  },
  {
    id: "MOD04",
    pattern: () => Lang,
    input: "A = B;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "A",
          pattern: { kind: LangPatternKind.ReferencePattern, name: "B" },
        },
      ],
    },
  },
  {
    id: "MOD05",
    pattern: () => Lang,
    input: "",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [],
    },
  },
  {
    id: "MOD06",
    pattern: () => Lang,
    input: "abc",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [],
    },
    matched: false,
    errors: [
      {
        name: "InvalidPatternDeclaration",
        message:
          "A pattern declaration was expected and should be in the form of [A = B;]",
        start: "0",
        end: "1",
      },
    ],
  },
]);