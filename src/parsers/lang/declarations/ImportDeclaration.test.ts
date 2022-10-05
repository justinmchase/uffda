import { tests } from "../../../test.ts";
import { Lang } from "../Lang.ts";
import { LangModuleKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "IMPORT00",
    pattern: () => Lang,
    input: "import './a.uff' (a);",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [
        {
          kind: LangModuleKind.ImportDeclaration,
          names: ["a"],
          modulePath: "./a.uff",
        },
      ],
      patterns: [],
    },
  },
  {
    id: "IMPORT01",
    pattern: () => Lang,
    input: "import (a) './a.uff';",
    value: {
      kind: LangModuleKind.PatternModule,
      imports: [],
      patterns: [],
    },
    matched: false,
    errors: [
      {
        name: "InvalidImportDeclaration",
        message:
          "Expected an import to be in the form [import './file.uff' (Name);]",
        start: "1",
        end: "6",
      },
    ],
  },
]);
