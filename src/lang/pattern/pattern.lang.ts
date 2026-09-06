import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { type GrammarOptions, parseGrammar } from "../grammar.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { Match } from "../../mod.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export type PatternOptions = GrammarOptions;

export async function patternGrammar(
  pattern: string,
  opts?: PatternOptions,
): Promise<Match<Pattern>> {
  return await parseGrammar<Pattern>({
    source: pattern,
    moduleUrl: new URL(import.meta.url),
    entryRuleName: "PatternLang",
    grammarOptions: {
      ...opts,
      declarations: {
        ...opts?.declarations,
        [new URL(import.meta.url).href]: PatternLang,
      },
    },
  });
}

export const PatternLang: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../source/mod.ts",
      names: [
        "Source",
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
      moduleUrl: "./pattern.ts",
      names: [
        "Pattern",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "PatternLang",
      default: true,
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "PatternTokens",
    },
  ],
  rules: [
    {
      name: "PatternTokens",
      parameters: [],
      pattern: {
        kind: PatternKind.Into,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "Pattern",
          args: [],
        },
      },
    },
    {
      name: "PatternLang",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "pattern",
            pattern: {
              kind: PatternKind.Pipeline,
              steps: [
                {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "Source",
                  args: [],
                },
                {
                  kind: PatternKind.Into,
                  pattern: {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "TokenizerNoWhitespace",
                    args: [],
                  },
                },
                {
                  kind: PatternKind.Into,
                  pattern: {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "Pattern",
                    args: [],
                  },
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
        fn: ({ pattern }): Pattern => pattern as Pattern,
      },
    },
  ],
};

export default PatternLang;
