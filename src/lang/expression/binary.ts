import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  BinaryExpression,
  PrimaryExpression,
  TerminalExpression,
  UnaryExpression,
} from "../../runtime/expressions/mod.ts";

export const Binary: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./unary.ts",
      names: [
        "Unary",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Binary",
      default: true,
    },
  ],
  rules: [
    {
      name: "Binary",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "Unary",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (
          { _ },
        ):
          | BinaryExpression
          | UnaryExpression
          | PrimaryExpression
          | TerminalExpression => _,
      },
    },
  ],
};

export default Binary;
