import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "NUMBER00",
    match: Match.Default(Scope.Default()),
    result: 7,
    expression: () => ({
      kind: ExpressionKind.Number,
      value: 7,
    }),
  },
]);