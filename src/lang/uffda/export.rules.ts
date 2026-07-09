import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";

export const ExportRules: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "ExportDeclarationSyntax",
    },
  ],
  rules: [
    {
      name: "ExportDeclarationSyntax",
      parameters: [],
      pattern: { kind: PatternKind.Fail },
    },
  ],
};

export default ExportRules;
