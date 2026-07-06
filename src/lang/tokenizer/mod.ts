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
      kind: ExportDeclarationKind.Import,
      name: "Token",
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
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "NewLine",
        args: [],
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
    },
  ],
};

export default Tokenizer;
