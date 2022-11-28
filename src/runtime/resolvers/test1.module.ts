import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../declarations/module.ts";

export default {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.Import,
      moduleUrl: "./test0.module.ts",
      names: ["A"],
    },
  ],
  rules: [],
} as IModuleDeclaration;
