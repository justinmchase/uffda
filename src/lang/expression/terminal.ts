import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { TerminalExpression } from "../../runtime/expressions/expression.ts";

export const Terminal: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./reference.ts",
      names: [
        "Reference",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./number.ts",
      names: [
        "Number",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Terminal",
    },
  ],
  rules: [
    {
      name: "Terminal",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "Number",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "Reference",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TerminalExpression => _,
      },
    },
  ],
};

export default Terminal;
