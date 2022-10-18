import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { tests } from "../../test.ts";
import { ExpressionKind } from "./expression.kind.ts";

tests(() => [
  {
    id: "ARRAY00",
    match: Match.Default(Scope.Default()).setVariables({
      a: 7,
      b: 11,
    }),
    result: [7, 11],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.Reference,
          name: "a",
        },
        {
          kind: ExpressionKind.Reference,
          name: "b",
        },
      ],
    }),
  },
  {
    id: "ARRAY01",
    match: Match.Default(Scope.Default()),
    result: [],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [],
    }),
  },

  {
    id: "ARRAY02",
    match: Match.Default(Scope.Default()).setVariables({
      a: [],
    }),
    result: [[[]]],
    expression: () => ({
      kind: ExpressionKind.Array,
      expressions: [
        {
          kind: ExpressionKind.Array,
          expressions: [
            {
              kind: ExpressionKind.Reference,
              name: "a",
            },
          ],
        },
      ],
    }),
  },
]);
