import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import type { SourceDocument } from "../source/mod.ts";
import type { TokenValue } from "./structured.ts";
import { semantic_texts } from "../../runtime/std/semantic_texts.ts";

export type TokenizerLangValue = {
  source: SourceDocument;
  /** Parser-compatible semantic token texts (comments omitted). */
  tokens: string[];
};

export const TokenizerLang: ModuleDeclaration = {
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
      moduleUrl: "./mod.uff",
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
            kind: PatternKind.Variable,
            name: "s",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Source",
              args: [],
            },
          },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Tokenizer",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _, s }): TokenizerLangValue => {
          if (s == null) {
            throw new TypeError("TokenizerLang expects Source to succeed");
          }
          return {
            source: s as SourceDocument,
            tokens: semantic_texts(_ as TokenValue[]),
          };
        },
      },
    },
  ],
};

export default TokenizerLang;
