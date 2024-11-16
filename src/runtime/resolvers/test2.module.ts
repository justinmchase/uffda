import { ImportDeclarationKind } from "../declarations/mod.ts";
import type { ModuleDeclaration } from "../declarations/module.ts";
import test0 from "./test0.module.ts";

export default {
  imports: [
    {
      kind: ImportDeclarationKind.Native,
      moduleUrl: "./test0.module.ts",
      names: ["A"],
      module: test0,
    },
  ],
  exports: [],
  rules: [],
} as ModuleDeclaration;
