import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { NewLine } from "./NewLine.ts";
import { Whitespace } from "./Whitespace.ts";
import { String } from "./String.ts";
import { Integer } from "./Integer.ts";
import { Identifier } from "./Identifier.ts";
import { Token } from "./Token.ts";
import { SpecialIdentifier } from "./SpecialIdentifier.ts";

export enum TokenizerKind {
  NewLine = "NewLine",
  Whitespace = "Whitespace",
  Integer = "Integer",
  SpecialIdentifier = "SpecialIdentifier",
  Identifier = "Identifier",
  String = "String",
  Token = "Token",
}

export const Tokenizer: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./NewLine.ts",
      module: NewLine,
      names: ["NewLine"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./Whitespace.ts",
      module: Whitespace,
      names: ["Whitespace"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./Integer.ts",
      module: Integer,
      names: ["Integer"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./SpecialIdentifier.ts",
      module: SpecialIdentifier,
      names: ["SpecialIdentifier"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./Identifier.ts",
      module: Identifier,
      names: ["Identifier"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./String.ts",
      module: String,
      names: ["String"],
    },
    {
      kind: DeclarationKind.NativeImport,
      moduleUrl: "./Token.ts",
      module: Token,
      names: ["Token"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Tokenizer",
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Reference,
                name: "NewLine",
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ kind: TokenizerKind.NewLine, value: _ }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Reference,
                name: "Whitespace",
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ kind: TokenizerKind.Whitespace, value: _ }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Reference,
                name: "Integer",
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({
                  kind: TokenizerKind.Integer,
                  value: parseInt(_),
                }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Reference,
                name: "SpecialIdentifier",
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({
                  kind: TokenizerKind.SpecialIdentifier,
                  value: _,
                }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Reference,
                name: "Identifier",
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ kind: TokenizerKind.Identifier, value: _ }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Reference,
                name: "String",
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ kind: TokenizerKind.String, value: _ }),
              },
            },
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Reference,
                name: "Token",
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({ kind: TokenizerKind.Token, value: _ }),
              },
            },
            {
              kind: PatternKind.Until,
              name: "InvalidToken",
              message: "Tokens are expected to be strings",
              pattern: { kind: PatternKind.Any },
            },
          ],
        },
      },
    },
  ],
};
