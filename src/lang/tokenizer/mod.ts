import { Type } from "@justinmchase/type";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import {
  foldLineComments,
  isTokenValue,
  StructuredTokenKind,
  type TokenValue,
  toSemanticNoWhitespaceTexts,
} from "./structured.ts";

export type { TokenValue } from "./structured.ts";
export {
  foldLineComments,
  isSemanticNoWhitespaceToken,
  isTokenValue,
  isTriviaToken,
  StructuredTokenKind,
  toSemanticNoWhitespaceTexts,
  toSemanticTexts,
} from "./structured.ts";

export const Tokenizer: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/characters/mod.ts",
      names: [
        "Combining",
        "Connecting",
        "Digit",
        "Formatting",
        "Letter",
        "Whitespace",
      ],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "./token.ts",
      names: [
        "Token",
      ],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Import,
      name: "Token",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "TokenizerNoWhitespace",
    },
    {
      kind: ExportDeclarationKind.Rule,
      name: "Tokenizer",
      default: true,
    },
  ],
  rules: [
    {
      name: "WhitespaceToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        min: 1,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "Whitespace",
          args: [],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue => ({
          kind: StructuredTokenKind.Whitespace,
          text: (_ as string[]).join(""),
        }),
      },
    },
    {
      name: "NewLineToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "\n",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue => ({
          kind: StructuredTokenKind.NewLine,
          text: _ as string,
        }),
      },
    },
    {
      name: "WordToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        min: 1,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Letter",
              args: [],
            },
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Connecting",
              args: [],
            },
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Combining",
              args: [],
            },
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Digit",
              args: [],
            },
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Formatting",
              args: [],
            },
          ],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue => ({
          kind: StructuredTokenKind.Word,
          text: (_ as string[]).join(""),
        }),
      },
    },
    {
      name: "PunctuationToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Type,
        type: Type.String,
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue => ({
          kind: StructuredTokenKind.Punctuation,
          text: _ as string,
        }),
      },
    },
    {
      name: "Tokens",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "WhitespaceToken",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "NewLineToken",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "WordToken",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "PunctuationToken",
            args: [],
          },
        ],
      },
    },
    {
      name: "Tokenizer",
      parameters: [],
      pattern: {
        kind: PatternKind.Quantifier,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "Tokens",
          args: [],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue[] => {
          const raw = _ as unknown[];
          if (!raw.every(isTokenValue)) {
            throw new TypeError(
              "Tokenizer expected token values from Tokens rules",
            );
          }
          return foldLineComments(raw);
        },
      },
    },
    {
      name: "NonWhitespaceToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Except,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Equal,
              value: "\n",
            },
            {
              kind: PatternKind.And,
              patterns: [
                {
                  kind: PatternKind.Type,
                  type: Type.String,
                },
                {
                  kind: PatternKind.Into,
                  pattern: {
                    kind: PatternKind.Quantifier,
                    min: 1,
                    pattern: {
                      kind: PatternKind.Resolve,
                      targetKind: ResolveTargetKind.Reference,
                      name: "Whitespace",
                      args: [],
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
    {
      name: "TokenizerNoWhitespace",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Tokenizer",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => {
          const tokens = _ as TokenValue[];
          return toSemanticNoWhitespaceTexts(tokens);
        },
      },
    },
  ],
};

export default Tokenizer;
