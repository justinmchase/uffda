import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Type } from "@justinmchase/type";

export const SharedRules: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.ts",
      names: ["Identifier"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "IdentifierToken",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "ReservedKeywordToken",
    },
  ],
  rules: [
    {
      name: "IdentifierToken",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
          {
            kind: PatternKind.Not,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ReservedKeywordToken",
              args: [],
            },
          },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Identifier",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): string => _ as string,
      },
    },
    {
      name: "ReservedKeywordToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "import",
          },
          {
            kind: PatternKind.Equal,
            value: "export",
          },
          {
            kind: PatternKind.Equal,
            value: "rule",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): string => _ as string,
      },
    },
  ],
};

export default SharedRules;
