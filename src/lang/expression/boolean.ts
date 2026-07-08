import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { BooleanExpression } from "../../runtime/expressions/expression.ts";

export const Boolean: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/token.ts",
      names: ["Token"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Boolean",
      default: true,
    },
  ],
  rules: [
    {
      name: "TrueKeyword",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "true" },
      expression: { kind: ExpressionKind.Native, fn: () => true },
    },
    {
      name: "FalseKeyword",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "false" },
      expression: { kind: ExpressionKind.Native, fn: () => false },
    },
    {
      name: "Boolean",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["TrueKeyword"],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: ["FalseKeyword"],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): BooleanExpression => ({
          kind: ExpressionKind.Boolean,
          value: _ as boolean,
        }),
      },
    },
  ],
};

export default Boolean;
