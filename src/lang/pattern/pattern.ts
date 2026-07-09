import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export const Pattern: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./or.ts",
      names: ["Or"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Pattern",
      default: true,
    },
  ],
  rules: [
    {
      name: "Pattern",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Or",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): Pattern => _ as Pattern,
      },
    },
  ],
};

export default Pattern;
