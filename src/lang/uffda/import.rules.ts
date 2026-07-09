import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { Type } from "@justinmchase/type";
import type { UffdaImportSyntaxDeclaration } from "./syntax.types.ts";

export const ImportRules: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./shared.rules.ts",
      names: ["IdentifierToken"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "ImportDeclarationSyntax",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "ImportNameList",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "ImportModuleSpecifier",
    },
  ],
  rules: [
    {
      name: "ImportDeclarationSyntax",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "import",
          },
          {
            kind: PatternKind.Variable,
            name: "moduleUrl",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ImportModuleSpecifier",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "names",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ImportNameList",
              args: [],
            },
          },
          {
            kind: PatternKind.Equal,
            value: ";",
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ moduleUrl, names }): UffdaImportSyntaxDeclaration => ({
          kind: "import",
          moduleUrl: moduleUrl as string,
          names: names as string[],
        }),
      },
    },
    {
      name: "ImportNameList",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "first",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "IdentifierToken",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "rest",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "IdentifierToken",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: (
          { first, rest },
        ): string[] => [first as string, ...(rest as string[])],
      },
    },
    {
      name: "ImportModuleSpecifier",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: '"',
          },
          {
            kind: PatternKind.Variable,
            name: "parts",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.And,
                patterns: [
                  {
                    kind: PatternKind.Not,
                    pattern: {
                      kind: PatternKind.Equal,
                      value: '"',
                    },
                  },
                  {
                    kind: PatternKind.Type,
                    type: Type.String,
                  },
                ],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: '"',
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ parts }): string => (parts as string[]).join(""),
      },
    },
  ],
};

export default ImportRules;
