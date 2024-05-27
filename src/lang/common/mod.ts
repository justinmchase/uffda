import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import {
  ImportDeclarationKind,
  ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import Letter from "./letter.ts";
import { Whitespace } from "./whitespace.ts";

export const Tokenizer: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Native,
      module: Whitespace,
      moduleUrl: "./whitespace.ts",
      names: [
        "Whitespace",
      ],
    },
    {
      kind: ImportDeclarationKind.Native,
      module: Letter,
      moduleUrl: "./letter.ts",
      names: [
        "Letter",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Import,
      name: "Whitespace",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "Letter",
    },
  ],
  rules: [],
};

export default Tokenizer;
