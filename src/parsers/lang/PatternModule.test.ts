import { tests } from "../../test.ts";
import { Lang } from "./Lang.ts";
import { LangModuleKind, LangPatternKind } from "./lang.pattern.ts";

tests(() => [
  {
    id: "MOD00",
    module: () => Lang,
    input: "A = B;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      rules: [
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
    module: () => Lang,
    input: "import './b.uff' (B); A = B;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [
        {
          kind: LangModuleKind.ImportDeclaration,
          names: ["B"],
          moduleUrl: "./b.uff",
        },
      ],
      rules: [
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
    module: () => Lang,
    input: "import './b.uff' (A B);",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [
        {
          kind: LangModuleKind.ImportDeclaration,
          names: ["A", "B"],
          moduleUrl: "./b.uff",
        },
      ],
      rules: [],
    },
  },
  {
    id: "MOD03",
    module: () => Lang,
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
          moduleUrl: "./b.uff",
        },
      ],
      rules: [],
    },
  },
  {
    id: "MOD04",
    module: () => Lang,
    input: "A = B;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      rules: [
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
    module: () => Lang,
    input: "",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      rules: [],
    },
  },
  {
    id: "MOD06",
    module: () => Lang,
    input: "abc",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      rules: [],
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
