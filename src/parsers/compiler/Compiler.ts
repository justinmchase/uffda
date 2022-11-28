import { PatternKind } from "../../runtime/patterns/mod.ts";
import { Lang } from "../lang/Lang.ts";
import { PatternModule } from "./PatternModule.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

export const Compiler: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternModule,
      moduleUrl: "./PatternModule.ts",
      names: ["PatternModule"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => Lang,
      moduleUrl: "../lang/Lang.ts",
      names: ["Lang"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Compiler",
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "Lang" },
          { kind: PatternKind.Reference, name: "PatternModule" },
        ],
      },
    },
  ],
};
