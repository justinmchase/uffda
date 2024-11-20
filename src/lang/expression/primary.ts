import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { TerminalExpression } from "./terminal.ts";
import type { StringExpression } from "../../runtime/expressions/expression.ts";

export type PrimaryExpression =
  | TerminalExpression
  | StringExpression;

export const Terminal: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./terminal.ts",
      names: [
        "Terminal",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./string.ts",
      names: [
        "String",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Primary",
    },
  ],
  rules: [
    {
      name: "Primary",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "Terminal",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "String",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): PrimaryExpression => _,
      },
    },
  ],
};

export default Terminal;
