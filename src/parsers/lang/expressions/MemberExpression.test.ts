import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { MemberExpression } from "./MemberExpression.ts";

tests(() => [
  {
    id: "MEMBEREXP00",
    module: () => MemberExpression,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "b" },
    ],
    value: {
      kind: LangExpressionKind.MemberExpression,
      name: "b",
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    },
  },
  {
    id: "MEMBEREXP01",
    module: () => MemberExpression,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "c" },
    ],
    value: {
      kind: LangExpressionKind.MemberExpression,
      name: "c",
      expression: {
        kind: LangExpressionKind.MemberExpression,
        name: "b",
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
      },
    },
  },
  {
    id: "MEMBEREXP02",
    module: () => MemberExpression,
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "b" },
    ],
    value: {
      kind: LangExpressionKind.MemberExpression,
      name: "b",
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
    id: "MEMBEREXP03",
    module: () => MemberExpression,
    input: [
      { kind: TokenizerKind.Token, value: "[" },
      { kind: TokenizerKind.Token, value: "]" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "b" },
    ],
    value: {
      kind: LangExpressionKind.MemberExpression,
      name: "b",
      expression: {
        kind: LangExpressionKind.ArrayExpression,
        expressions: [],
      },
    },
  },
]);
