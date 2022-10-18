import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "VALUE00",
    match: Match.Default(Scope.Default()),
    result: 7,
    expression: () => ({
      kind: ExpressionKind.Value,
      value: 7,
    }),
  },
  {
    id: "VALUE01",
    match: Match.Default(Scope.Default()),
    result: 18,
    expression: () => ({
      kind: ExpressionKind.Add,
      left: {
        kind: ExpressionKind.Value,
        value: 7,
      },
      right: {
        kind: ExpressionKind.Value,
        value: 11,
      },
    }),
  },
]);
