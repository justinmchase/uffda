import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  PrimaryExpression,
  TerminalExpression,
} from "../../runtime/expressions/expression.ts";

export const Primary: ModuleDeclaration = {
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
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./sequence.ts",
      names: [
        "Sequence",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Primary",
      default: true,
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
            name: "Sequence",
            args: [],
          },
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
        fn: ({ _ }): PrimaryExpression | TerminalExpression => _,
      },
    },
  ],
};

export default Primary;
