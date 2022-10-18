import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
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
      kind: ExpressionKind.Add,
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
      kind: ExpressionKind.Add,
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
]);
