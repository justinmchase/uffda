import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { ExpressionLang } from "../ExpressionLang.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { SpreadExpression } from "./SpreadExpression.ts";

tests(() => [
  {
    id: "LANG.EXPRESSIONS.SPREAD00",
    module: () => SpreadExpression,
    input: [
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "{" },
      { kind: TokenizerKind.Token, value: "}" },
    ],
    value: {
      kind: LangExpressionKind.ObjectExpression,
      keys: [],
    },
  },
  {
    id: "LANG.EXPRESSIONS.SPREAD01",
    module: () => SpreadExpression,
    input: [
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "[" },
      { kind: TokenizerKind.Token, value: "]" },
    ],
    value: { kind: "ArrayExpression", expressions: [] },
  },
  {
    id: "LANG.EXPRESSIONS.SPREAD02",
    module: () => SpreadExpression,
    input: [
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Identifier, value: "c" },
    ],
    value: {
      kind: LangExpressionKind.MemberExpression,
      expression: {
        kind: LangExpressionKind.MemberExpression,
        expression: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
        name: "b",
      },
      name: "c",
    },
  },
  {
    id: "LANG.EXPRESSIONS.SPREAD03",
    module: () => SpreadExpression,
    input: [
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "." },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangExpressionKind.InvocationExpression,
      arguments: [],
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "a",
      },
    },
  },
]);
