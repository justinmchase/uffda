import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type {
  UffdaExportSyntaxDeclaration,
  UffdaRuleSyntaxDeclaration,
  UffdaSyntaxDeclaration,
} from "./syntax.types.ts";

export const ExportRules: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./shared.rules.ts",
      names: ["IdentifierToken"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./rule.rules.ts",
      names: ["RuleDeclarationSyntax"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "ExportDeclarationSyntax",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "ExportNameList",
    },
  ],
  rules: [
    {
      name: "ExportDeclarationSyntax",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "InlineExportedRuleDeclarationSyntax",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "StandaloneExportDeclarationSyntax",
            args: [],
          },
        ],
      },
    },
    {
      name: "InlineExportedRuleDeclarationSyntax",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: "export" },
          {
            kind: PatternKind.Variable,
            name: "rule",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "RuleDeclarationSyntax",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ rule }): UffdaSyntaxDeclaration[] => {
          const declaration = rule as UffdaRuleSyntaxDeclaration;
          return [
            { kind: "export", name: declaration.name },
            declaration,
          ];
        },
      },
    },
    {
      name: "StandaloneExportDeclarationSyntax",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: "export" },
          {
            kind: PatternKind.Variable,
            name: "names",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ExportNameList",
              args: [],
            },
          },
          { kind: PatternKind.Equal, value: ";" },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ names }): UffdaExportSyntaxDeclaration[] =>
          (names as string[]).map((name) => ({ kind: "export", name })),
      },
    },
    {
      name: "ExportNameList",
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
        fn: ({ first, rest }): string[] => [
          first as string,
          ...(rest as string[]),
        ],
      },
    },
  ],
};

export default ExportRules;
