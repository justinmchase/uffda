import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import {
  ImportDeclarationKind,
  ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { Whitespace } from "./whitespace.ts";

export const Tokenizer: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Native,
      module: Whitespace,
      moduleUrl: "./common/mod.ts",
      names: [
        "Whitespace",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Import,
      name: "Whitespace",
    },
  ],
  rules: [],
};

export default Tokenizer;
