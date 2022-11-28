import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ArrayExpression } from "./ArrayExpression.ts";

tests(() => [
  {
    id: "LANG.EXPRESSION.ARRAY00",
    module: () => ArrayExpression,
    input: [
      { kind: TokenizerKind.Token, value: "[" },
      { kind: TokenizerKind.Token, value: "]" },
    ],
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [],
    },
  },
  {
    id: "LANG.EXPRESSION.ARRAY01",
    module: () => ArrayExpression,
    input: [
      { kind: TokenizerKind.Token, value: "[" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Identifier, value: "c" },
      { kind: TokenizerKind.Token, value: "]" },
    ],
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
        },
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "b",
          },
        },
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "c",
          },
        },
      ],
    },
  },
  {
    id: "LANG.EXPRESSION.ARRAY02",
    module: () => ArrayExpression,
    input: [
      { kind: TokenizerKind.Token, value: "[" },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: "]" },
    ],
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.InvocationExpression,
            arguments: [],
            expression: {
              kind: LangExpressionKind.ReferenceExpression,
              name: "a",
            },
          },
        },
      ],
    },
  },
  {
    id: "LANG.EXPRESSION.ARRAY03",
    module: () => ArrayExpression,
    input: [
      { kind: TokenizerKind.Token, value: "[" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "]" },
    ],
    value: {
      kind: LangExpressionKind.ArrayExpression,
      expressions: [
        {
          kind: LangExpressionKind.ArrayElementExpression,
          expression: {
            kind: LangExpressionKind.MemberExpression,
            name: "b",
            expression: {
              kind: LangExpressionKind.ReferenceExpression,
              name: "a",
            },
          },
        },
      ],
    },
  },
]);
