import { Type } from "@justinmchase/type";
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
        "NewLine",
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
      kind: ExportDeclarationKind.Rule,
      name: "Tokenizer",
    },
    {
      kind: ExportDeclarationKind.Import,
      name: "Token",
    },
  ],
  rules: [
    {
      name: "WhitespaceToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        min: 1,
        pattern: {
          kind: PatternKind.Reference,
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
        kind: PatternKind.Reference,
        name: "NewLine",
        args: [],
      },
    },
    {
      name: "WordToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        min: 1,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Reference,
              name: "Letter",
              args: [],
            },
            {
              kind: PatternKind.Reference,
              name: "Connecting",
              args: [],
            },
            {
              kind: PatternKind.Reference,
              name: "Combining",
              args: [],
            },
            {
              kind: PatternKind.Reference,
              name: "Digit",
              args: [],
            },
            {
              kind: PatternKind.Reference,
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
            kind: PatternKind.Reference,
            name: "WhitespaceToken",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "NewLineToken",
            args: [],
          },
          {
            kind: PatternKind.Reference,
            name: "WordToken",
            args: [],
          },
          {
            kind: PatternKind.Reference,
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
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Reference,
          name: "Tokens",
          args: [],
        },
      },
    },
  ],
};

export default Tokenizer;
