import { ExportDeclarationKind } from "../../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../../runtime/declarations/mod.ts";
import type { ModuleDeclaration } from "../../../runtime/declarations/mod.ts";

export const Characters: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./combining.uff",
      names: [
        "Combining",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./connecting.uff",
      names: [
        "Connecting",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./digit.uff",
      names: [
        "Digit",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./formatting.uff",
      names: [
        "Formatting",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./letter.uff",
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
      moduleUrl: "./whitespace.uff",
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
