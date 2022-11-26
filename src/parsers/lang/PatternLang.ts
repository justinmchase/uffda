import { PatternKind } from "../../runtime/patterns/mod.ts";
import { Basic } from "../basic.ts";
import { LangPatternKind } from "./lang.pattern.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/mod.ts";
import { PatternPattern } from "./patterns/mod.ts";

export const PatternLang: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "../basic.ts",
      module: Basic,
      names: ["Basic"]
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./patterns/PatternPattern.ts",
      module: PatternPattern,
      names: ["PatternPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternLang",
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "Basic" },
          {
            kind: PatternKind.Reference,
            name: LangPatternKind.PatternPattern,
          },
        ],
      },
    },
  ],
};
