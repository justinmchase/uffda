import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "REFERENCE00",
    match: Match.Default(Scope.Default()).setVariables({
      a: 7,
    }),
    result: 7,
    expression: () => ({
      kind: ExpressionKind.Reference,
      name: "a",
    }),
  },
  {
    id: "REFERENCE01",
    match: Match.Default(Scope.Default()).setVariables({
      a: 7,
      b: 11,
    }),
    result: 11,
    expression: () => ({
      kind: ExpressionKind.Reference,
      name: "b",
    }),
  },
]);
