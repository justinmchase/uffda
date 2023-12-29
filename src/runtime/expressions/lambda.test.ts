import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { tests } from "../../test.ts";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { BinaryOperation } from "./mod.ts";

tests(() => [
  {
    id: "RUNTIME.LAMBDA00",
    match: Match.Default(
      Scope.Default().addVariables({
        a: 7,
        b: 11,
      }),
    ),
    result: 18,
    expression: () => ({
      // (!any -> a + b)
      kind: ExpressionKind.Invocation,
      args: [],
      expression: {
        kind: ExpressionKind.Lambda,
        pattern: {
          kind: PatternKind.Not,
          pattern: {
            kind: PatternKind.Any,
          },
        },
        expression: {
          kind: ExpressionKind.Binary,
          op: BinaryOperation.Add,
          left: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
          right: {
            kind: ExpressionKind.Reference,
            name: "b",
          },
        },
      },
    }),
  },
  {
    id: "RUNTIME.LAMBDA01",
    match: Match.Default(
      Scope.Default().addVariables({
        a: 7,
        b: 11,
      }),
    ),
    result: 18,
    expression: () => ({
      // (!any -> [native])
      kind: ExpressionKind.Invocation,
      args: [],
      expression: {
        kind: ExpressionKind.Lambda,
        pattern: {
          kind: PatternKind.Not,
          pattern: {
            kind: PatternKind.Any,
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => 7 + 11,
        },
      },
    }),
  },
  {
    id: "RUNTIME.LAMBDA02",
    match: Match.Default(Scope.Default()),
    result: 18,
    expression: () => ({
      // (a:any b:any -> a + b 7 11)
      kind: ExpressionKind.Invocation,
      args: [
        {
          kind: ExpressionKind.Value,
          value: 7,
        },
        {
          kind: ExpressionKind.Value,
          value: 11,
        },
      ],
      expression: {
        kind: ExpressionKind.Lambda,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Variable,
              name: "a",
              pattern: { kind: PatternKind.Any },
            },
            {
              kind: PatternKind.Variable,
              name: "b",
              pattern: { kind: PatternKind.Any },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Binary,
          op: BinaryOperation.Add,
          left: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
          right: {
            kind: ExpressionKind.Reference,
            name: "b",
          },
        },
      },
    }),
  },
  {
    id: "RUNTIME.LAMBDA03",
    match: Match.Default(Scope.Default()),
    result: 18,
    expression: () => ({
      // (a:any b:any -> a + b 7 11)
      kind: ExpressionKind.Invocation,
      args: [
        {
          kind: ExpressionKind.Value,
          value: 7,
        },
        {
          kind: ExpressionKind.Value,
          value: 11,
        },
      ],
      expression: {
        kind: ExpressionKind.Lambda,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Variable,
              name: "a",
              pattern: { kind: PatternKind.Any },
            },
            {
              kind: PatternKind.Variable,
              name: "b",
              pattern: { kind: PatternKind.Any },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Binary,
          op: BinaryOperation.Add,
          left: {
            kind: ExpressionKind.Reference,
            name: "a",
          },
          right: {
            kind: ExpressionKind.Reference,
            name: "b",
          },
        },
      },
    }),
  },
]);
