import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { BinaryOperation } from "./mod.ts";

tests(() => [
  {
    id: "RUNTIME.MEMBER00",
    match: Match.Default(Scope.Default()).setVariables({
      a: { x: 7, y: 11 },
    }),
    result: 18,
    expression: () => ({
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Add,
      left: {
        kind: ExpressionKind.Member,
        name: "x",
        expression: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
      },
      right: {
        kind: ExpressionKind.Member,
        name: "y",
        expression: {
          kind: ExpressionKind.Reference,
          name: "a",
        },
      },
    }),
  },
  {
    id: "RUNTIME.MEMBER01",
    match: Match.Default(Scope.Default()),
    throws: true,
    expression: () => ({
      kind: ExpressionKind.Member,
      name: "x",
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
    }),
  },

  {
    id: "RUNTIME.MEMBER02",
    match: Match.Default(Scope.Default()).setVariables({
      a: {},
    }),
    value: undefined,
    expression: () => ({
      kind: ExpressionKind.Member,
      name: "x",
      expression: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
    }),
  },
]);
