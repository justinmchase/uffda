import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { Expression as Expr } from "../../runtime/expressions/mod.ts";

export const Expression: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./binary.ts",
      names: [
        "Binary",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Expression",
      default: true,
    },
  ],
  rules: [
    {
      name: "Expression",
      parameters: [],
      pattern: {
        kind: PatternKind.Reference,
        name: "Binary",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): Expr => _,
      },
    },
  ],
};

export default Expression;
