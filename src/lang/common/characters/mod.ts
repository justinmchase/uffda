import { ExportDeclarationKind } from "../../../runtime/declarations/export.ts";
import {
  ImportDeclarationKind,
  ModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";

export const Characters: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./combining.ts",
      names: [
        "Combining",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./connecting.ts",
      names: [
        "Connecting",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./digit.ts",
      names: [
        "Digit",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./formatting.ts",
      names: [
        "Formatting",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./letter.ts",
      names: [
        "Letter",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./newLine.ts",
      names: [
        "NewLine",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./whitespace.ts",
      names: [
        "Whitespace",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Import,
      name: "Combining",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "Connecting",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "Digit",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "Formatting",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "Letter",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "NewLine",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "Whitespace",
    },
  ],
  rules: [],
};

export default Characters;
