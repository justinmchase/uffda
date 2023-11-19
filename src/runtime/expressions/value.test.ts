import { Match } from "../../match.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { BinaryOperation } from "./mod.ts";

tests(() => [
  {
    id: "VALUE00",
    match: Match.Default(),
    result: 7,
    expression: () => ({
      kind: ExpressionKind.Value,
      value: 7,
    }),
  },
  {
    id: "VALUE01",
    match: Match.Default(),
    result: 18,
    expression: () => ({
      kind: ExpressionKind.Binary,
      op: BinaryOperation.Add,
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
