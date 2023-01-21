import { PatternKind } from "../../runtime/patterns/mod.ts";
import { Basic } from "../basic.ts";
import { LangPatternKind } from "./lang.pattern.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { ExpressionPattern } from "./patterns/ExpressionPattern.ts";

export const ExpressionLang: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    // Basic
    {
      kind: DeclarationKind.NativeImport,
      module: () => Basic,
      moduleUrl: "../basic.ts",
      names: ["Basic"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ExpressionPattern,
      moduleUrl: "./patterns/ExpressionPattern.ts",
      names: ["ExpressionPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ExpressionLang",
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "Basic" },
          {
            kind: PatternKind.Reference,
            name: LangPatternKind.ExpressionPattern,
          },
        ],
      },
    },
  ],
};
