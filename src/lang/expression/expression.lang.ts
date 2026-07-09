import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { type GrammarOptions, parseGrammar } from "../grammar.ts";
import type { Match } from "../../mod.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { Expression } from "../../runtime/expressions/mod.ts";

export type ExprOptions = GrammarOptions;

export async function expressionGrammar(
  expression: string,
  opts?: ExprOptions,
): Promise<Match<Expression>> {
  return await parseGrammar<Expression>({
    source: expression,
    moduleUrl: new URL(import.meta.url),
    entryRuleName: "ExpressionLang",
    grammarOptions: opts,
  });
}

export const ExpressionLang: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../source-normalization/mod.ts",
      names: [
        "SourceNormalizationAndIndex",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../tokenizer/mod.ts",
      names: [
        "TokenizerNoWhitespace",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./expression.ts",
      names: [
        "Expression",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "ExpressionLang",
    },
  ],
  rules: [
    {
      name: "ExpressionComplete",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "expression",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Expression",
              args: [],
            },
          },
          {
            kind: PatternKind.End,
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ expression }): Expression => expression as Expression,
      },
    },
    {
      name: "ExpressionLang",
      parameters: [],
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
            name: "ExpressionComplete",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): Expression => _ as Expression,
      },
    },
  ],
};

export default ExpressionLang;
