import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { ModuleDeclaration } from "../declarations/module.ts";

export default {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.ModuleImport,
      moduleUrl: "./test0.module.ts",
      names: ["A"],
    },
  ],
  rules: [],
} as ModuleDeclaration;
