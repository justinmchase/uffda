import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { BinaryOperation } from "./expression.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "ADD00",
    match: Match.Default(Scope.Default()).setVariables({
      a: 7,
      b: 11,
    }),
    result: 18,
    expression: () => ({
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
    }),
  },
  {
    id: "ADD01",
    match: Match.Default(Scope.Default()).setVariables({
      a: "l",
      b: 11,
      c: "r",
    }),
    result: "lr",
    expression: () => ({
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Add,
      left: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      right: {
        kind: ExpressionKind.Reference,
        name: "c",
      },
    }),
  },
  {
    id: "SUB00",
    match: Match.Default(Scope.Default()).setVariables({
      a: 3,
      b: 2,
    }),
    result: 1,
    expression: () => ({
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Subtract,
      left: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      right: {
        kind: ExpressionKind.Reference,
        name: "b",
      },
    }),
  },
  {
    id: "SUB01",
    match: Match.Default(Scope.Default()).setVariables({
      a: 100,
      b: 50,
      c: 25,
    }),
    result: 75,
    expression: () => ({
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Subtract,
      left: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      right: {
        kind: ExpressionKind.Binary,
        op: BinaryOperation.Subtract,
        left: {
          kind: ExpressionKind.Reference,
          name: "b",
        },
        right: {
          kind: ExpressionKind.Reference,
          name: "c",
        },
      },
    }),
  },
  {
    id: "MULT01",
    match: Match.Default(Scope.Default()).setVariables({
      a: 7,
      b: 11,
    }),
    result: 77,
    expression: () => ({
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Multiply,
      left: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      right: {
        kind: ExpressionKind.Reference,
        name: "b",
      },
    }),
  },
]);
