import { Match } from "../../match.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "STRING00",
    match: Match.Default(),
    result: "abc",
    expression: () => ({
      kind: ExpressionKind.String,
      value: "abc",
    }),
  },
]);
