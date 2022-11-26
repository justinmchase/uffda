import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { SubtractExpression } from "./SubtractExpression.ts";

tests(() => [
  {
    id: "LANG.EXPRESSION.SUBTRACT00",
    module: () => SubtractExpression,
    input: [
      { kind: TokenizerKind.Integer, value: 11 },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Integer, value: 7 },
    ],
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: { kind: LangExpressionKind.NumberExpression, value: 11 },
      right: { kind: LangExpressionKind.NumberExpression, value: 7 },
    },
  },
  {
    id: "LANG.EXPRESSION.SUBTRACT01",
    module: () => SubtractExpression,
    input: [
      { kind: TokenizerKind.Integer, value: 11 },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Integer, value: 7 },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Integer, value: 13 },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Integer, value: 3 },
    ],
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: {
        kind: LangExpressionKind.AddExpression,
        left: { kind: LangExpressionKind.NumberExpression, value: 11 },
        right: { kind: LangExpressionKind.NumberExpression, value: 7 },
      },
      right: {
        kind: LangExpressionKind.AddExpression,
        left: { kind: LangExpressionKind.NumberExpression, value: 13 },
        right: { kind: LangExpressionKind.NumberExpression, value: 3 },
      },
    },
  },
  {
    id: "LANG.EXPRESSION.SUBTRACT02",
    module: () => SubtractExpression,
    input: [
      { kind: TokenizerKind.Integer, value: 11 },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Integer, value: 7 },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Integer, value: 13 },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Integer, value: 3 },
    ],
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: {
        kind: LangExpressionKind.SubtractExpression,
        left: {
          kind: LangExpressionKind.SubtractExpression,
          left: { kind: LangExpressionKind.NumberExpression, value: 11 },
          right: { kind: LangExpressionKind.NumberExpression, value: 7 },
        },
        right: { kind: LangExpressionKind.NumberExpression, value: 13 },
      },
      right: { kind: LangExpressionKind.NumberExpression, value: 3 },
    },
  },
  {
    id: "LANG.EXPRESSION.SUBTRACT03",
    module: () => SubtractExpression,
    input: [
      { kind: TokenizerKind.Integer, value: 11 },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Integer, value: 7 },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Integer, value: 13 },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Integer, value: 3 },
    ],
    value: {
      kind: LangExpressionKind.SubtractExpression,
      left: {
        kind: LangExpressionKind.SubtractExpression,
        left: {
          kind: LangExpressionKind.NumberExpression,
          value: 11,
        },
        right: {
          kind: LangExpressionKind.AddExpression,
          left: { kind: LangExpressionKind.NumberExpression, value: 7 },
          right: { kind: LangExpressionKind.NumberExpression, value: 13 },
        },
      },
      right: { kind: LangExpressionKind.NumberExpression, value: 3 },
    },
  },
]);
