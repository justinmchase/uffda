import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ObjectExpression } from "./ObjectExpression.ts";

tests(() => [
  {
    id: "LANG.EXPRESSION.OBJECT00",
    module: () => ObjectExpression,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [],
    },
  },
  {
    id: "LANG.EXPRESSION.OBJECT01",
    module: () => ObjectExpression,
    // input: "{ a = 1 }",
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Integer, value: 1 },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "a",
          expression: { kind: LangExpressionKind.NumberExpression, value: 1 },
        },
      ],
    },
  },
  {
    id: "LANG.EXPRESSION.OBJECT02",
    module: () => ObjectExpression,
    input: [
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Integer, value: 1 },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Integer, value: 2 },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "a",
          expression: { kind: LangExpressionKind.NumberExpression, value: 1 },
        },
        {
          kind: LangExpressionKind.ObjectKeyExpression,
          key: "b",
          expression: { kind: LangExpressionKind.NumberExpression, value: 2 },
        },
      ],
    },
  },
]);
