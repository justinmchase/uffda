import { PatternKind } from "../../runtime/patterns/mod.ts";
import { LangModuleKind } from "./lang.pattern.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { Basic } from "../basic.ts";
import { PatternModule } from "./PatternModule.ts";

export const Lang: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "../basic.ts",
      module: Basic,
      names: ["Basic"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./PatternModule.ts",
      module: PatternModule,
      names: ["PatternModule"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Lang",
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "Basic" },
          { kind: PatternKind.Reference, name: LangModuleKind.PatternModule },
        ],
      },
    },
  ],
};
