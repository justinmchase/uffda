import {
  ExportDeclarationKind,
  ImportDeclarationKind,
} from "../declarations/mod.ts";
import type { ModuleDeclaration } from "../declarations/module.ts";

export default {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./test0.module.ts",
      names: ["A"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Import,
      name: "A",
    },
  ],
  rules: [],
} as ModuleDeclaration;
