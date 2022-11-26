import { tests } from "../../../test.ts";
import { LangModuleKind } from "../lang.pattern.ts";
import { ImportDeclaration } from "./ImportDeclaration.ts";
import { InvalidImportDeclaration } from "./InvalidImportDeclaration.ts";

tests(() => [
  {
    id: "IMPORT00",
    module: () => ImportDeclaration,
    input: [
      { kind: 'Identifier', value: 'import' },
      { kind: 'String', value: './test.uff' },
      { kind: 'Token',      value: '(' },
      { kind: 'Identifier', value: 'Test'},
      { kind: 'Token',      value: ')' },
      { kind: 'Token',      value: ';' },
    ],
    value: {
      kind: LangModuleKind.ImportDeclaration,
      names: ["Test"],
      modulePath: "./test.uff",
    },
  },
  {
    id: "IMPORT01",
    module: () => InvalidImportDeclaration,
    input: [
      { kind: 'Identifier', value: 'import' },
      { kind: 'Token',      value: '(' },
      { kind: 'Identifier', value: 'Test'},
      { kind: 'Token',      value: ')' },
      { kind: 'String', value: './test.uff' },
      { kind: 'Token',      value: ';' },
    ],
    value: undefined,
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
