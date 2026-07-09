import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type {
  Expression,
  NotExpression,
} from "../../runtime/expressions/expression.ts";

export const Not: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/token.ts",
      names: ["Token"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./primary.ts",
      names: ["Primary"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Not",
      default: true,
    },
  ],
  rules: [
    {
      name: "Not",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "not",
          },
          {
            kind: PatternKind.Variable,
            name: "expression",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Token",
              args: ["Primary"],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ expression }): NotExpression => ({
          kind: ExpressionKind.Not,
          expression: expression as Expression,
        }),
      },
    },
  ],
};

export default Not;
