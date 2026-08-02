import { Type } from "@justinmchase/type";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

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
        fn: ({ _ }) => _.join(""),
      },
    },
    {
      name: "NewLineToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "\n",
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
        fn: ({ _ }) => _.join(""),
      },
    },
    {
      name: "PunctuationToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Type,
        type: Type.String,
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
        fn: ({ _ }) => {
          const tokens = _ as string[];
          const semanticTokens: string[] = [];
          let inComment = false;
          let inString = false;
          let escaped = false;

          for (const token of tokens) {
            if (inComment) {
              if (token === "\n") {
                inComment = false;
                semanticTokens.push(token);
              }
              continue;
            }

            if (!inString && token === "#") {
              inComment = true;
              continue;
            }

            if (token === '"' && !escaped) {
              inString = !inString;
            }

            semanticTokens.push(token);
            escaped = inString && token === "\\" && !escaped;
          }

          return semanticTokens;
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
        fn: ({ _ }) =>
          (_ as string[]).filter((token) => token.trim().length > 0),
      },
    },
  ],
};

export default Tokenizer;
