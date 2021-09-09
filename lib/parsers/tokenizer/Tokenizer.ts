import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { String } from "./String.ts";
import { Whitespace } from "./Whitespace.ts";
import { Integer } from "./Integer.ts";
import { Identifier } from "./Identifier.ts";
import { Token } from "./Token.ts";
import { NewLine } from "./NewLine.ts";
import { SpecialIdentifier } from "./SpecialIdentifier.ts";

export enum TokenizerType {
  NewLine = "NewLine",
  Whitespace = "Whitespace",
  Integer = "Integer",
  SpecialIdentifier = "SpecialIdentifier",
  Identifier = "Identifier",
  String = "String",
  Token = "Token",
}

export const Tokenizer: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Slice,
    min: 0,
    pattern: {
      kind: PatternKind.Or,
      patterns: [
        {
          kind: PatternKind.Projection,
          pattern: NewLine,
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => ({ type: TokenizerType.NewLine, value: _ }),
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: Whitespace,
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => ({ type: TokenizerType.Whitespace, value: _ }),
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: Integer,
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => ({
              type: TokenizerType.Integer,
              value: parseInt(_),
            }),
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: SpecialIdentifier,
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => ({
              type: TokenizerType.SpecialIdentifier,
              value: _,
            }),
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: Identifier,
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => ({ type: TokenizerType.Identifier, value: _ }),
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: String,
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => ({ type: TokenizerType.String, value: _ }),
          },
        },
        {
          kind: PatternKind.Projection,
          pattern: Token,
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ _ }) => ({ type: TokenizerType.Token, value: _ }),
          },
        },
      ],
    },
  },
};
