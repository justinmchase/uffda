import { tests } from "../../test.ts";
import { LangModuleKind } from "./lang.pattern.ts";
import { Lang } from "./Lang.ts";

tests(() => [
  {
    id: "LANG00",
    only: true,
    pattern: () => Lang,
    input: `
      A = B;
      xyz;
      C = D;
    `,
    matched: false, // Errors in a pipeline step will result in matched false
    errors: [
      {
        name: "InvalidPatternDeclaration",
        message: "A pattern declaration was expected and should be in the form of [A = B;]",
        start: "4",
        end: "6",
      },
    ],
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [
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
    }
  },
]);
