import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { MatchKind } from "../../match.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { SourceDocument } from "../source-normalization/mod.ts";

export type TokenizerLangValue = {
  source: SourceDocument;
  tokens: unknown;
};

export const TokenizerLang: ModuleDeclaration = {
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
      moduleUrl: "./mod.ts",
      names: [
        "Tokenizer",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "TokenizerLang",
      default: true,
    },
  ],
  rules: [
    {
      name: "TokenizerLang",
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
            name: "Tokenizer",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }, _specials, match): TokenizerLangValue => {
          const sourceMatch = match.matches[0];
          if (!sourceMatch || sourceMatch.kind !== MatchKind.Ok) {
            throw new TypeError(
              "TokenizerLang expects SourceNormalizationAndIndex to succeed",
            );
          }

          return {
            source: sourceMatch.value as SourceDocument,
            tokens: _,
          };
        },
      },
    },
  ],
};

export default TokenizerLang;
