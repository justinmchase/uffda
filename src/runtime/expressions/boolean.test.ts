import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "BOOLEAN00",
    match: Match.Default(Scope.Default()),
    result: true,
    expression: () => ({
      kind: ExpressionKind.Boolean,
      value: true,
    }),
  },
  {
    id: "BOOLEAN01",
    match: Match.Default(Scope.Default()),
    result: false,
    expression: () => ({
      kind: ExpressionKind.Boolean,
      value: false,
    }),
  },
]);
