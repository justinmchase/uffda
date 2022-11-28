import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { LambdaExpression } from "./LambdaExpression.ts";

tests(() => [
  {
    id: "LANG.LAMBDA00",
    module: () => LambdaExpression,
    // input: "(a -> a)",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "a" },
      expression: { kind: LangExpressionKind.ReferenceExpression, name: "a" },
    },
  },
  {
    id: "LANG.LAMBDA01",
    module: () => LambdaExpression,
    // input: "(a -> a + 1)",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Integer, value: 1 },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "a" },
      expression: {
        kind: LangExpressionKind.AddExpression,
        left: {
          kind: LangExpressionKind.ReferenceExpression,
          name: "a",
        },
        right: {
          kind: LangExpressionKind.NumberExpression,
          value: 1,
        },
      },
    },
  },
  {
    id: "LANG.LAMBDA02",
    module: () => LambdaExpression,
    // input: "(a -> (b -> a + b))",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "+" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: ")" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "a" },
      expression: {
        kind: LangExpressionKind.LambdaExpression,
        pattern: { kind: LangPatternKind.ReferencePattern, name: "b" },
        expression: {
          kind: LangExpressionKind.AddExpression,
          left: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "a",
          },
          right: {
            kind: LangExpressionKind.ReferenceExpression,
            name: "b",
          },
        },
      },
    },
  },
  {
    id: "LANG.LAMBDA03",
    module: () => LambdaExpression,
    // input: "(a b -> _)",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "_" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: {
        kind: LangPatternKind.ThenPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "a",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "b",
        },
      },
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "_",
      },
    },
  },
  {
    id: "LANG.LAMBDA04",
    module: () => LambdaExpression,

    // this is ambiguous between a lambda expression
    // and a projection pattern, because the pattern
    // is PatternPattern vs the lower priority ThenPattern
    // Should we have projec
    // input: "(a | b -> _)",
    input: [
      { kind: TokenizerKind.Token, value: "(" },
      { kind: TokenizerKind.Identifier, value: "a" },
      { kind: TokenizerKind.Token, value: "|" },
      { kind: TokenizerKind.Identifier, value: "b" },
      { kind: TokenizerKind.Token, value: "-" },
      { kind: TokenizerKind.Token, value: ">" },
      { kind: TokenizerKind.Identifier, value: "_" },
      { kind: TokenizerKind.Token, value: ")" },
    ],
    value: {
      kind: LangExpressionKind.LambdaExpression,
      pattern: {
        kind: LangPatternKind.OrPattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "a",
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "b",
        },
      },
      expression: {
        kind: LangExpressionKind.ReferenceExpression,
        name: "_",
      },
    },
  },
]);
