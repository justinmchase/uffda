import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  ModuleDeclaration,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import { Whitespace } from "../common/whitespace.ts";
import { NewLine } from "../common/newLine.ts";
import { Identifier } from "../common/identifier.ts";

export const Tokenizer: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Native,
      module: Whitespace,
      moduleUrl: "../common/whitespace.ts",
      names: [
        "Whitespace",
      ],
    },
    {
      kind: ImportDeclarationKind.Native,
      module: NewLine,
      moduleUrl: "../common/newLine.ts",
      names: [
        "NewLine",
      ],
    },
    {
      kind: ImportDeclarationKind.Native,
      module: Identifier,
      moduleUrl: "../common/identifier.ts",
      names: [
        "Identifier",
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
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => ({
          kind: "whitespace",
          value: _,
        }),
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
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => ({
          kind: "newline",
          value: _,
        }),
      },
    },
    {
      name: "IdentifierToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Reference,
        name: "Identifier",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => ({
          kind: "identifier",
          value: _,
        }),
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
            name: "IdentifierToken",
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
