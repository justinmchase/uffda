import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "SUB00",
    match: Match.Default(Scope.Default()).setVariables({
      a: 3,
      b: 2,
    }),
    result: 1,
    expression: () => ({
      kind: ExpressionKind.Subtract,
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
      kind: ExpressionKind.Subtract,
      left: {
        kind: ExpressionKind.Reference,
        name: "a",
      },
      right: {
        kind: ExpressionKind.Subtract,
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
]);
