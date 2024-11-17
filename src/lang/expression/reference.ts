import { Type } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { ReferenceExpression } from "../../runtime/expressions/expression.ts";

export const Reference: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.ts",
      names: [
        "Identifier",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Main",
    },
  ],
  rules: [
    {
      name: "Main",
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
              kind: PatternKind.Reference,
              name: "Identifier",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): ReferenceExpression => ({
          kind: ExpressionKind.Reference,
          name: _,
        }),
      },
    },
  ],
};

export default Reference;
