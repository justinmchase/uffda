import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { PipelinePattern } from "./PipelinePattern.ts";

export const PatternPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./PipelinePattern.ts",
      module: PipelinePattern,
      names: ["PipelinePattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternPattern",
      pattern: {
        kind: PatternKind.Reference,
        name: LangPatternKind.PipelinePattern,
      },
    },
  ],
};
