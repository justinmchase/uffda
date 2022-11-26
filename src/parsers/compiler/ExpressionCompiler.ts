import { PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionLang } from "../lang/ExpressionLang.ts";
import { ExpressionPattern } from "./patterns/mod.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";

export const ExpressionCompiler: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "../lang/ExpressionLang.ts",
      names: ["ExpressionLang"],
      module: ExpressionLang,
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "../lang/ExpressionPattern.ts",
      names: ["ExpressionPattern"],
      module: ExpressionPattern,
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ExpressionCompiler",
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "ExpressionLang" },
          { kind: PatternKind.Reference, name: "ExpressionPattern" },
        ],
      },
    }
  ]
};
