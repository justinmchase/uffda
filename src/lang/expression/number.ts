import { Type } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { ReferenceExpression } from "../../runtime/expressions/expression.ts";
import { NumberExpression } from "../../runtime/expressions/mod.ts";

export const Number: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/characters/digit.ts",
      names: [
        "Digit",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Number",
    },
  ],
  rules: [
    {
      name: "Number",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Slice,
              min: 1,
              pattern: {
                kind: PatternKind.Reference,
                name: "Digit",
                args: [],
              }
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): NumberExpression => ({
          kind: ExpressionKind.Number,
          value: parseInt(_.join(''))
        }),
      },
    },
  ],
};

export default Number;
