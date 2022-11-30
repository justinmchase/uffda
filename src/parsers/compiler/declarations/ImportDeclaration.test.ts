import { tests } from "../../../test.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { LangModuleKind } from "../../lang/lang.pattern.ts";
import { ImportDeclaration } from "./ImportDeclaration.ts";

tests(() => [
  {
    id: "IMPORTDECLARATION00",
    trace: true,
    description: "import './test.ts' (Test);",
    module: () => ImportDeclaration,
    input: [
      {
        kind: LangModuleKind.ImportDeclaration,
        names: ["Test"],
        moduleUrl: "./test.ts",
      },
    ],
    value: {
      kind: DeclarationKind.Import,
      names: ["Test"],
      moduleUrl: "./test.ts",
    },
  },
]);
