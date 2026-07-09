import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { type GrammarOptions, parseGrammar } from "../grammar.ts";
import type { Match } from "../../mod.ts";
import type {
  UffdaSyntaxDeclaration,
  UffdaSyntaxModule,
} from "./syntax.types.ts";
export type {
  UffdaExportSyntaxDeclaration,
  UffdaImportSyntaxDeclaration,
  UffdaRuleSyntaxDeclaration,
  UffdaSyntaxDeclaration,
  UffdaSyntaxModule,
} from "./syntax.types.ts";

export type UffdaOptions = GrammarOptions;

export async function uffdaGrammar(
  source: string,
  opts?: UffdaOptions,
): Promise<Match<UffdaSyntaxModule>> {
  return await parseGrammar<UffdaSyntaxModule>({
    source,
    moduleUrl: new URL(import.meta.url),
    entryRuleName: "UffdaLang",
    grammarOptions: opts,
  });
}

export const UffdaLang: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../source-normalization/mod.ts",
      names: ["SourceNormalizationAndIndex"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/mod.ts",
      names: ["TokenizerNoWhitespace"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./shared.rules.ts",
      names: ["IdentifierToken", "ReservedKeywordToken"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./import.rules.ts",
      names: [
        "ImportDeclarationSyntax",
        "ImportNameList",
        "ImportModuleSpecifier",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./export.rules.ts",
      names: ["ExportDeclarationSyntax"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./rule.rules.ts",
      names: [
        "RulePatternBody",
        "RuleProjectionExpression",
        "RulePatternToken",
        "RuleProjectionToken",
        "RulePatternTokenUntilSemicolon",
        "RulePatternTokenUntilProjection",
        "RulePatternBodyWithoutProjection",
        "RulePatternBodyBeforeProjection",
        "RuleDeclarationSyntax",
        "RuleDeclarationWithoutProjection",
        "RuleDeclarationWithProjection",
        "RuleProjectionTail",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "UffdaLang",
      default: true,
    },
  ],
  rules: [
    {
      name: "ModuleBody",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "imports",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "ImportDeclarationSyntax",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Variable,
            name: "rules",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "RuleDeclarationSyntax",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ imports, rules }): UffdaSyntaxModule => ({
          kind: "module",
          declarations: [
            ...(imports as UffdaSyntaxDeclaration[]),
            ...(rules as UffdaSyntaxDeclaration[]),
          ],
        }),
      },
    },
    {
      name: "UffdaLang",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "module",
            pattern: {
              kind: PatternKind.Pipeline,
              steps: [
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "SourceNormalizationAndIndex",
                  args: [],
                },
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "TokenizerNoWhitespace",
                  args: [],
                },
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "ModuleBody",
                  args: [],
                },
              ],
            },
          },
          {
            kind: PatternKind.End,
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ module }): UffdaSyntaxModule => module as UffdaSyntaxModule,
      },
    },
  ],
};

export default UffdaLang;

export {
  type CompileUffdaModuleOptions,
  compileUffdaSyntaxModule,
  executeUffdaSource,
  type ExecuteUffdaSourceOptions,
} from "./execute.ts";
