import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { AddExpression } from "./AddExpression.ts";

tests(() => [
  {
    id: "ADD00",
    module: () => AddExpression,
    input: [
      { kind: TokenizerKind.Integer, value: 1 },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Integer, value: 2 },
    ],
    value: {
      kind: LangExpressionKind.AddExpression,
      left: { kind: LangExpressionKind.NumberExpression, value: 1 },
      right: { kind: LangExpressionKind.NumberExpression, value: 2 },
    },
  },
  {
    id: "ADD01",
    module: () => AddExpression,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Identifier, value: "b" },
    ],
    value: {
      kind: LangExpressionKind.AddExpression,
      left: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
      right: { kind: LangExpressionKind.ReferenceExpression, name: "b" },
    },
  },
  {
    id: "ADD02",
    module: () => AddExpression,
    // input: "(a.b) + c.d",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Identifier, value: "c" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "d" },
    ],
    value: {
      kind: LangExpressionKind.AddExpression,
      left: {
        kind: LangExpressionKind.InvocationExpression,
        arguments: [],
        expression: {
          kind: LangExpressionKind.MemberExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
          name: "b",
        },
      },
      right: {
        kind: LangExpressionKind.MemberExpression,
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "c",
        },
        name: "d",
      },
    },
  },
]);
