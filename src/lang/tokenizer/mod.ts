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
  isTokenValue,
  StructuredTokenKind,
  type TokenValue,
  toSemanticNoWhitespaceTexts,
} from "./structured.ts";

export type { TokenValue } from "./structured.ts";
export {
  isSemanticNoWhitespaceToken,
  isTokenValue,
  isTriviaToken,
  StructuredTokenKind,
  toSemanticNoWhitespaceTexts,
  toSemanticTexts,
} from "./structured.ts";

function flattenTokens(value: unknown): TokenValue[] {
  if (isTokenValue(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(flattenTokens);
  throw new TypeError(
    "Tokenizer expected token values from Tokens rules",
  );
}

export const Tokenizer: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/characters/mod.uff",
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
      name: "DQuoteToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: '"',
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
      name: "CommentToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "#",
          },
          {
            kind: PatternKind.Quantifier,
            pattern: {
              kind: PatternKind.Except,
              pattern: {
                kind: PatternKind.Equal,
                value: "\n",
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue => {
          const [hash, rest] = _ as [string, string[]];
          return {
            kind: StructuredTokenKind.Comment,
            text: hash + rest.join(""),
          };
        },
      },
    },
    {
      name: "EscapeFollower",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Whitespace",
            args: [],
          },
          {
            kind: PatternKind.Equal,
            value: "\n",
          },
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
          {
            kind: PatternKind.Type,
            type: Type.String,
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): string => _ as string,
      },
    },
    {
      name: "EscapeTokens",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Equal,
            value: "\\",
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapeFollower",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue[] => {
          const [, escaped] = _ as [string, string];
          return [
            {
              kind: StructuredTokenKind.Punctuation,
              text: "\\",
            },
            {
              kind: StructuredTokenKind.Punctuation,
              text: escaped,
            },
          ];
        },
      },
    },
    {
      name: "StringPunctuationToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Except,
        pattern: {
          kind: PatternKind.Equal,
          value: '"',
        },
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
      name: "StringInterior",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapeTokens",
            args: [],
          },
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
            name: "StringPunctuationToken",
            args: [],
          },
        ],
      },
    },
    {
      name: "QuotedStringTokens",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "DQuoteToken",
            args: [],
          },
          {
            kind: PatternKind.Quantifier,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "StringInterior",
              args: [],
            },
          },
          {
            kind: PatternKind.Maybe,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "DQuoteToken",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): TokenValue[] => {
          const [open, interior, close] = _ as [
            TokenValue,
            unknown[],
            TokenValue | undefined,
          ];
          const tokens = [open, ...flattenTokens(interior)];
          if (close) tokens.push(close);
          return tokens;
        },
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
            name: "QuotedStringTokens",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CommentToken",
            args: [],
          },
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
        fn: ({ _ }): TokenValue[] => flattenTokens(_),
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
