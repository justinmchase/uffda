import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { ModuleDeclaration } from "../declarations/module.ts";
import test0 from "./test0.module.ts";

export default {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./test0.module.ts",
      names: ["A"],
      module: test0,
    },
  ],
  rules: [],
} as ModuleDeclaration;
