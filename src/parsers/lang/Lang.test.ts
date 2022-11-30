import { tests } from "../../test.ts";
import {
  LangExpressionKind,
  LangModuleKind,
  LangPatternKind,
} from "./lang.pattern.ts";
import { Lang } from "./Lang.ts";

tests(() => [
  {
    id: "LANG00",
    module: () => Lang,
    input: `
      A = B;
      xyz;
      C = D;
    `,
    matched: false, // Errors in a pipeline step will result in matched false
    errors: [
      {
        name: "InvalidPatternDeclaration",
        message:
          "A pattern declaration was expected and should be in the form of [A = B;]",
        start: "4",
        end: "6",
      },
    ],
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      rules: [
        {
          kind: "PatternDeclaration",
          name: "A",
          pattern: { kind: "ReferencePattern", name: "B" },
        },
        {
          kind: "PatternDeclaration",
          name: "C",
          pattern: { kind: "ReferencePattern", name: "D" },
        },
      ],
    },
  },
  {
    id: "LANG01",
    module: () => Lang,
    input: "x = y; a = b;",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      rules: [
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
  {
    id: "LANG02",
    module: () => Lang,
    input: "A = (_ -> '');",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      rules: [
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "A",
          pattern: {
            kind: LangPatternKind.ProjectionPattern,
            pattern: { kind: LangPatternKind.ReferencePattern, name: "_" },
            expression: {
              kind: LangExpressionKind.StringExpression,
              value: "",
            },
          },
        },
      ],
    },
  },
  {
    id: "LANG03",
    module: () => Lang,
    input: `
      import './test.uff' (B);
      A = B;
    `,
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [
        {
          kind: LangModuleKind.ImportDeclaration,
          moduleUrl: "./test.uff",
          names: ["B"],
        },
      ],
      rules: [
        {
          kind: LangModuleKind.PatternDeclaration,
          name: "A",
          pattern: {
            kind: LangPatternKind.ReferencePattern,
            name: "B",
          },
        },
      ],
    },
  },
]);
