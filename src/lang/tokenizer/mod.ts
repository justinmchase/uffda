import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind, ValueType } from "../../runtime/patterns/mod.ts";

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
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Main",
    },
  ],
  rules: [
    {
      name: "WhitespaceToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Reference,
        name: "Whitespace",
        args: [],
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
        type: ValueType.String,
      },
    },
    {
      name: "Token",
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
      name: "Main",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Reference,
          name: "Token",
          args: [],
        },
      },
    },
  ],
};

export default Tokenizer;
