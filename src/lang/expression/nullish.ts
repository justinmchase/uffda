import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { ValueExpression } from "../../runtime/expressions/expression.ts";

export const Nullish: ModuleDeclaration = {
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
      name: "Nullish",
      default: true,
    },
  ],
  rules: [
    {
      name: "NullKeyword",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "null" },
      expression: { kind: ExpressionKind.Native, fn: () => null },
    },
    {
      name: "UndefinedKeyword",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "undefined" },
      expression: { kind: ExpressionKind.Native, fn: () => undefined },
    },
    {
      name: "Nullish",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: [{
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "NullKeyword",
              args: [],
            }],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Token",
            args: [{
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "UndefinedKeyword",
              args: [],
            }],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): ValueExpression => ({
          kind: ExpressionKind.Value,
          value: _,
        }),
      },
    },
  ],
};

export default Nullish;
