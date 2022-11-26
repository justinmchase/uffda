import { PatternKind } from "../../runtime/patterns/mod.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/mod.ts";
import { PatternLang } from "../lang/PatternLang.ts";
import { PatternPattern } from "./patterns/PatternPattern.ts";

export const PatternCompiler: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternLang,
      moduleUrl: "../lang/PatternLang.ts",
      names: ["PatternLang"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "./patterns/PatternPattern.ts",
      names: ["PatternPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternCompiler",
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "PatternLang" },
          { kind: PatternKind.Reference, name: "PatternPattern" },
        ],
      },
    }
  ]
};
