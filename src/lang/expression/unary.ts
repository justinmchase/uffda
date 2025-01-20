import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  PrimaryExpression,
  TerminalExpression,
  UnaryExpression,
} from "../../runtime/expressions/mod.ts";

export const Unary: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./primary.ts",
      names: [
        "Primary",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Unary",
      default: true,
    },
  ],
  rules: [
    {
      name: "Unary",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "Primary",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): UnaryExpression | PrimaryExpression | TerminalExpression =>
          _,
      },
    },
  ],
};

export default Unary;
