import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { InvocationExpression } from "./InvocationExpression.ts";

tests(() => [
  {
    id: "INVOKE00",
    module: () => InvocationExpression,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
    ],  
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
      expression: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
    },
  },
  {
    id: "INVOKE01",
    module: () => InvocationExpression,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: ")" },
    ],  
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
      expression: {
        kind: LangExpressionKind.InvocationExpression,
        arguments: [],
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
      },
    },
  },
  {
    id: "INVOKE02",
    module: () => InvocationExpression,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: ")" },
    ],  
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "b",
        },
      ],
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    },
  },
  {
    id: "INVOKE03",
    module: () => InvocationExpression,
    // input: "(a b c d)",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Identifier, value: "c" },
      { kind: TokenizerKind.Identifier, value: "d" },
      { kind: TokenizerKind.Token, value: ")" },
    ],  
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "b",
        },
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "c",
        },
        {
          kind: LangExpressionKind.ReferenceExpression,
          name: "d",
        },
      ],
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    },
  },
  {
    id: "INVOKE04",
    module: () => InvocationExpression,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "join" },
      { kind: TokenizerKind.Token, value: ")" },
    ],  
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
      expression: {
        kind: LangExpressionKind.MemberExpression,
        name: "join",
        expression: {
          kind: LangExpressionKind.InvocationExpression,
          arguments: [],
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
        },
      },
    },
  },
]);
